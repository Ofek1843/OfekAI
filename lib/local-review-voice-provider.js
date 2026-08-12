"use strict";

const crypto = require("crypto");
const fs = require("fs");
const fsp = fs.promises;
const path = require("path");

const ASSET_ID_PATTERN = /^local_[a-f0-9]{32}$/;
const MIME_BY_EXTENSION = Object.freeze({ webm: "audio/webm", ogg: "audio/ogg", m4a: "audio/mp4" });

function isLoopbackEndpoint(value) {
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(String(value || "").trim().replace(/^https?:\/\//i, ""));
}

function localReviewVoiceEnabled(env = process.env) {
  return String(env.LOCAL_REVIEW_VOICE_ENABLED || "") === "1"
    && String(env.NODE_ENV || "").toLowerCase() !== "production"
    && String(env.FUELPHYSIQUE_LOCAL_DEMO || "") === "1"
    && isLoopbackEndpoint(env.FIREBASE_AUTH_EMULATOR_HOST)
    && isLoopbackEndpoint(env.FIRESTORE_EMULATOR_HOST)
    && isLoopbackEndpoint(env.LOCAL_REVIEW_BIND_HOST || "127.0.0.1");
}

function httpError(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

class LocalReviewVoiceProvider {
  constructor({ rootDir, bindHost = "127.0.0.1", port = 3304, secret = crypto.randomBytes(32) } = {}) {
    if (!rootDir) throw new TypeError("Local review voice storage requires an explicit root directory.");
    if (!isLoopbackEndpoint(bindHost)) throw new TypeError("Local review voice playback must use a loopback host.");
    this.rootDir = path.resolve(rootDir);
    this.assetDir = path.join(this.rootDir, "assets");
    this.metadataDir = path.join(this.rootDir, "metadata");
    this.baseUrl = `http://${String(bindHost).replace(/^localhost$/i, "127.0.0.1")}:${Number(port)}`;
    this.secret = Buffer.from(secret);
    this.localReview = true;
  }

  async ensureDirectories() {
    await Promise.all([
      fsp.mkdir(this.assetDir, { recursive: true }),
      fsp.mkdir(this.metadataDir, { recursive: true })
    ]);
  }

  metadataPath(assetId) {
    if (!ASSET_ID_PATTERN.test(String(assetId || ""))) throw httpError(404, "Local voice asset not found.");
    return path.join(this.metadataDir, `${assetId}.json`);
  }

  async upload({ file, fileName, folder, isPrivateFile }) {
    if (!Buffer.isBuffer(file) || isPrivateFile !== true) throw httpError(400, "Invalid local review voice upload.");
    const extension = path.extname(String(fileName || "")).slice(1).toLowerCase();
    const mimeType = MIME_BY_EXTENSION[extension];
    if (!mimeType) throw httpError(415, "Unsupported local review voice format.");
    await this.ensureDirectories();
    const assetId = `local_${crypto.randomBytes(16).toString("hex")}`;
    const assetPath = path.join(this.assetDir, `${assetId}.${extension}`);
    const metadata = {
      fileId: assetId,
      filePath: `${String(folder || "").replace(/\/$/, "")}/${path.basename(String(fileName || "voice"))}`,
      isPrivateFile: true,
      url: `local-review://${assetId}`,
      mimeType,
      assetPath,
      size: file.length
    };
    await fsp.writeFile(assetPath, file, { flag: "wx" });
    await fsp.writeFile(this.metadataPath(assetId), JSON.stringify(metadata), { encoding: "utf8", flag: "wx" });
    return metadata;
  }

  async getFileDetails(assetId) {
    try {
      const metadata = JSON.parse(await fsp.readFile(this.metadataPath(assetId), "utf8"));
      await fsp.access(metadata.assetPath, fs.constants.R_OK);
      return metadata;
    } catch (error) {
      if (Number(error?.statusCode) === 404 || error?.code === "ENOENT") throw httpError(404, "Local voice asset not found.");
      throw error;
    }
  }

  async deleteFile(assetId) {
    const metadata = await this.getFileDetails(assetId);
    await Promise.all([
      fsp.rm(metadata.assetPath, { force: true }),
      fsp.rm(this.metadataPath(assetId), { force: true })
    ]);
  }

  signature(assetId, expires) {
    return crypto.createHmac("sha256", this.secret).update(`${assetId}.${expires}`).digest("hex");
  }

  getPlaybackUrl({ assetId, ttlSeconds = 600 }) {
    if (!ASSET_ID_PATTERN.test(String(assetId || ""))) throw httpError(404, "Local voice asset not found.");
    const expires = Math.floor(Date.now() / 1000) + Math.max(60, Math.min(3600, Number(ttlSeconds) || 600));
    const signature = this.signature(assetId, expires);
    return `${this.baseUrl}/api/local-review/voice/${encodeURIComponent(assetId)}?expires=${expires}&signature=${signature}`;
  }

  verifyPlaybackToken(assetId, expiresValue, signature) {
    if (!ASSET_ID_PATTERN.test(String(assetId || ""))) return false;
    const expires = Number(expiresValue);
    if (!Number.isInteger(expires) || expires <= Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.signature(assetId, expires), "hex");
    let supplied;
    try { supplied = Buffer.from(String(signature || ""), "hex"); } catch { return false; }
    return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
  }

  async servePlayback(req, res) {
    const assetId = String(req.params.assetId || "");
    if (!this.verifyPlaybackToken(assetId, req.query.expires, req.query.signature)) {
      res.status(403).json({ error: "Local voice playback authorization expired." });
      return;
    }
    let metadata;
    try { metadata = await this.getFileDetails(assetId); }
    catch { res.status(410).json({ error: "This local voice message is no longer available." }); return; }

    const stat = await fsp.stat(metadata.assetPath);
    const range = String(req.headers.range || "");
    res.set({
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-store, max-age=0",
      "Content-Type": metadata.mimeType,
      "X-Content-Type-Options": "nosniff"
    });
    if (!range) {
      res.set("Content-Length", String(stat.size));
      fs.createReadStream(metadata.assetPath).pipe(res);
      return;
    }
    const match = range.match(/^bytes=(\d*)-(\d*)$/);
    if (!match) { res.status(416).end(); return; }
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1;
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || start >= stat.size) {
      res.status(416).set("Content-Range", `bytes */${stat.size}`).end();
      return;
    }
    res.status(206).set({
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${stat.size}`
    });
    fs.createReadStream(metadata.assetPath, { start, end }).pipe(res);
  }
}

function createLocalReviewVoiceProvider({ env = process.env, rootDir, bindHost, port } = {}) {
  if (!localReviewVoiceEnabled(env)) return null;
  return new LocalReviewVoiceProvider({ rootDir, bindHost, port });
}

module.exports = {
  ASSET_ID_PATTERN,
  LocalReviewVoiceProvider,
  createLocalReviewVoiceProvider,
  isLoopbackEndpoint,
  localReviewVoiceEnabled
};
