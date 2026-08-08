"use strict";

const { SocialError, cleanString, sanitizeClientId, stableMessageId } = require("./social-domain");

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MAX_DURATION_MS = 120_000;
const DEFAULT_PLAYBACK_TTL_SECONDS = 600;
const MIN_DURATION_MS = 250;

const MIME_EXTENSIONS = Object.freeze({
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a"
});

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function voiceMessageConfig(env = process.env) {
  return Object.freeze({
    maxBytes: boundedInteger(env.VOICE_MESSAGE_MAX_BYTES, DEFAULT_MAX_BYTES, 64 * 1024, 25 * 1024 * 1024),
    maxDurationMs: boundedInteger(env.VOICE_MESSAGE_MAX_SECONDS, DEFAULT_MAX_DURATION_MS / 1000, 1, 300) * 1000,
    playbackTtlSeconds: boundedInteger(env.VOICE_MESSAGE_PLAYBACK_TTL_SECONDS, DEFAULT_PLAYBACK_TTL_SECONDS, 60, 3600)
  });
}

function baseMimeType(value) {
  return cleanString(value, 120).toLowerCase().split(";", 1)[0].trim();
}

function hasWebmSignature(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3;
}

function hasOggSignature(buffer) {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString("ascii") === "OggS";
}

function hasMp4Signature(buffer) {
  return buffer.length >= 12 && buffer.subarray(4, 8).toString("ascii") === "ftyp";
}

function validateVoiceUpload({ buffer, mimeType, durationMs, clientId }, config = voiceMessageConfig()) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new SocialError("voice_file_required", "Choose a recorded voice message to send.", 400);
  }
  if (buffer.length > config.maxBytes) {
    throw new SocialError("voice_file_too_large", "This voice message is too large to send.", 413);
  }
  const normalizedMimeType = baseMimeType(mimeType);
  const extension = MIME_EXTENSIONS[normalizedMimeType];
  if (!extension) {
    throw new SocialError("voice_format_unsupported", "This browser produced an unsupported audio format.", 415);
  }
  const validSignature = normalizedMimeType === "audio/webm" ? hasWebmSignature(buffer)
    : normalizedMimeType === "audio/ogg" ? hasOggSignature(buffer)
      : hasMp4Signature(buffer);
  if (!validSignature) {
    throw new SocialError("voice_signature_invalid", "The recorded audio file could not be verified.", 415);
  }
  const normalizedDurationMs = Number(durationMs);
  if (!Number.isFinite(normalizedDurationMs) || normalizedDurationMs < MIN_DURATION_MS || normalizedDurationMs > config.maxDurationMs) {
    throw new SocialError("voice_duration_invalid", "Record a voice message within the allowed duration.", 400);
  }
  return {
    clientId: sanitizeClientId(clientId),
    durationMs: Math.round(normalizedDurationMs),
    mimeType: normalizedMimeType,
    sizeBytes: buffer.length,
    extension
  };
}

function voiceMessageId(uid, clientId) {
  return stableMessageId(uid, clientId);
}

function safePathSegment(value, maxLength = 160) {
  const result = cleanString(value, maxLength).replace(/[^A-Za-z0-9_-]/g, "");
  if (!result) throw new SocialError("invalid_voice_path", "Voice-message ownership could not be verified.", 400);
  return result;
}

function voiceAssetFolder(uid, conversationId) {
  return `/fuelphysique/users/${safePathSegment(uid, 128)}/voice/${safePathSegment(conversationId, 300)}`;
}

function voiceAssetFileName(messageId, extension, nonce) {
  const safeExtension = Object.values(MIME_EXTENSIONS).includes(extension) ? extension : "bin";
  return `${safePathSegment(messageId, 100)}-${safePathSegment(nonce, 40)}.${safeExtension}`;
}

function voiceAssetBelongsTo(metadata, { uid, conversationId, assetId } = {}) {
  if (!metadata || String(metadata.fileId || "") !== String(assetId || "")) return false;
  const expectedPrefix = `${voiceAssetFolder(uid, conversationId)}/`;
  return String(metadata.filePath || "").startsWith(expectedPrefix) && metadata.isPrivateFile === true;
}

function safeVoiceMetadata(value = {}, config = voiceMessageConfig()) {
  const durationMs = Number(value.durationMs);
  const sizeBytes = Number(value.sizeBytes);
  const mimeType = baseMimeType(value.mimeType);
  const assetId = cleanString(value.assetId, 200);
  if (!assetId || !MIME_EXTENSIONS[mimeType]
      || !Number.isFinite(durationMs) || durationMs < MIN_DURATION_MS || durationMs > config.maxDurationMs
      || !Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > config.maxBytes) {
    throw new SocialError("voice_metadata_invalid", "Voice-message metadata could not be verified.", 400);
  }
  return {
    assetId,
    durationMs: Math.round(durationMs),
    mimeType,
    sizeBytes: Math.round(sizeBytes)
  };
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_DURATION_MS,
  DEFAULT_PLAYBACK_TTL_SECONDS,
  MIME_EXTENSIONS,
  MIN_DURATION_MS,
  baseMimeType,
  safeVoiceMetadata,
  validateVoiceUpload,
  voiceAssetBelongsTo,
  voiceAssetFileName,
  voiceAssetFolder,
  voiceMessageConfig,
  voiceMessageId
};
