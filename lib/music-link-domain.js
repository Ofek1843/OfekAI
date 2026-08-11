"use strict";

const net = require("node:net");
const { SocialError } = require("./social-domain");

const MAX_MUSIC_URL_LENGTH = 2048;
const MAX_MUSIC_TITLE_LENGTH = 80;

function musicError(code, message) {
  return new SocialError(code, message, 400);
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 192 && b === 0 && (c === 0 || c === 2))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113);
}

function isPrivateHost(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/\.$/, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  const ipVersion = net.isIP(host);
  if (ipVersion === 4) return isPrivateIpv4(host);
  if (ipVersion === 6) {
    const normalized = host.replace(/^\[|\]$/g, "");
    return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")
      || /^fe[89ab]/.test(normalized) || normalized.startsWith("2001:db8:")
      || normalized.startsWith("::ffff:127.") || normalized.startsWith("::ffff:10.") || normalized.startsWith("::ffff:192.168.");
  }
  return !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(host);
}

function providerForHostname(hostname) {
  const host = hostname.toLowerCase();
  if (host === "open.spotify.com") return "spotify";
  if (host === "music.apple.com") return "apple_music";
  if (host === "music.youtube.com") return "youtube_music";
  if (host === "youtube.com" || host === "www.youtube.com" || host === "youtu.be") return "youtube";
  if (host === "soundcloud.com" || host === "www.soundcloud.com") return "soundcloud";
  return "link";
}

function cleanMusicTitle(value) {
  if (value === undefined || value === null || value === "") return "";
  const title = String(value).replace(/[<>\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (title.length > MAX_MUSIC_TITLE_LENGTH) throw musicError("music_title_too_long", `Music titles can be up to ${MAX_MUSIC_TITLE_LENGTH} characters.`);
  return title;
}

function normalizeMusicLink(input = {}) {
  const raw = String(input.url || "").trim();
  if (!raw || raw.length > MAX_MUSIC_URL_LENGTH) throw musicError("invalid_music_url", "Enter a valid HTTPS music link.");
  let parsed;
  try { parsed = new URL(raw); } catch { throw musicError("invalid_music_url", "Enter a valid HTTPS music link."); }
  if (parsed.protocol !== "https:") throw musicError("unsafe_music_url", "Only HTTPS music links are allowed.");
  if (parsed.username || parsed.password) throw musicError("unsafe_music_url", "Links containing credentials are not allowed.");
  if (parsed.port && parsed.port !== "443") throw musicError("unsafe_music_url", "Custom ports are not allowed in music links.");
  if (isPrivateHost(parsed.hostname)) throw musicError("unsafe_music_url", "Local and private-network links are not allowed.");
  parsed.hash = "";
  return {
    url: parsed.href,
    provider: providerForHostname(parsed.hostname),
    title: cleanMusicTitle(input.title)
  };
}

module.exports = {
  MAX_MUSIC_TITLE_LENGTH,
  MAX_MUSIC_URL_LENGTH,
  cleanMusicTitle,
  isPrivateHost,
  normalizeMusicLink,
  providerForHostname
};
