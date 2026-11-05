"use strict";
const crypto = require("node:crypto");
const MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

function createImageUploadAuth(uid, input, config, now = Math.floor(Date.now() / 1000)) {
  const invalid = () => { throw Object.assign(new Error("Invalid photo upload."), { status: 400 }); };
  if (typeof uid !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || !input
    || typeof input.mimeType !== "string" || !Object.hasOwn(MIME, input.mimeType)) invalid();
  let suffix;
  if (input.purpose === "progress" && typeof input.entryId === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(input.entryId)) suffix = `progressPhotos/${input.entryId}`;
  else if (input.purpose === "profile") suffix = "social-profile";
  else invalid();
  const nonce = crypto.randomUUID();
  const profile = input.purpose === "profile";
  const uploadParams = {
    folder: `/fuelphysique/users/${uid}/${suffix}`,
    fileName: profile ? `profile-${uid}.${MIME[input.mimeType]}` : `${nonce}.${MIME[input.mimeType]}`,
    useUniqueFileName: "false",
    overwriteFile: profile ? "true" : "false",
    isPrivateFile: input.purpose === "progress" ? "true" : "false",
    checks: `"file.size" <= 5242880 AND "file.mime" IN ["${input.mimeType}"]`,
    tags: `fuelphysique,${profile ? "social-profile" : "progress-photo"},upload-${nonce}`
  };
  const encode = value => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "HS256", typ: "JWT", kid: config.publicKey });
  const payload = encode({ ...uploadParams, iat: now, exp: now + 300 });
  const signature = crypto.createHmac("sha256", config.privateKey).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${signature}`, uploadParams };
}
module.exports = { createImageUploadAuth };
