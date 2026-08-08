"use strict";

const crypto = require("crypto");
const {
  safeVoiceMetadata,
  validateVoiceUpload,
  voiceAssetBelongsTo,
  voiceAssetFileName,
  voiceAssetFolder,
  voiceMessageConfig
} = require("./voice-message-domain");
const { SocialError } = require("./social-domain");

function providerError(code, message, status = 503) {
  const error = new SocialError(code, message, status);
  return error;
}

class VoiceMediaService {
  constructor({ provider = null, config = voiceMessageConfig(), randomUUID = crypto.randomUUID } = {}) {
    this.provider = provider;
    this.config = config;
    this.randomUUID = randomUUID;
  }

  assertConfigured() {
    if (!this.provider) throw providerError("voice_storage_unavailable", "Voice messages are temporarily unavailable.");
  }

  async upload({ uid, conversationId, messageId, buffer, mimeType, durationMs, clientId }) {
    this.assertConfigured();
    const validated = validateVoiceUpload({ buffer, mimeType, durationMs, clientId }, this.config);
    const nonce = this.randomUUID().replaceAll("-", "").slice(0, 16);
    let uploaded;
    try {
      uploaded = await this.provider.upload({
        file: buffer,
        fileName: voiceAssetFileName(messageId, validated.extension, nonce),
        folder: voiceAssetFolder(uid, conversationId),
        useUniqueFileName: false,
        isPrivateFile: true,
        responseFields: ["isPrivateFile"],
        tags: ["fuelphysique", "voice-message"]
      });
    } catch (error) {
      throw providerError("voice_upload_failed", "The voice message could not be uploaded. Try again.");
    }
    const result = uploaded?.response || uploaded || {};
    if (!voiceAssetBelongsTo(result, { uid, conversationId, assetId: result.fileId })) {
      if (result.fileId) await this.provider.deleteFile(result.fileId).catch(() => {});
      throw providerError("voice_upload_unverified", "The uploaded voice message could not be verified.");
    }
    return safeVoiceMetadata({
      assetId: result.fileId,
      durationMs: validated.durationMs,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes
    });
  }

  async verifyOwnedAsset({ uid, conversationId, assetId }) {
    this.assertConfigured();
    let details;
    try {
      details = await this.provider.getFileDetails(assetId);
    } catch (error) {
      if (Number(error?.statusCode || error?.status) === 404) return { status: "already_absent" };
      throw providerError("voice_asset_verification_failed", "Voice-message access could not be verified.");
    }
    const metadata = details?.response || details || {};
    if (!voiceAssetBelongsTo(metadata, { uid, conversationId, assetId })) return { status: "ownership_mismatch" };
    return { status: "verified", metadata };
  }

  async playbackUrl({ uid, conversationId, assetId }) {
    const verified = await this.verifyOwnedAsset({ uid, conversationId, assetId });
    if (verified.status === "already_absent") throw new SocialError("voice_unavailable", "This voice message is no longer available.", 410);
    if (verified.status !== "verified") throw new SocialError("voice_asset_forbidden", "Voice-message ownership could not be verified.", 403);
    const source = verified.metadata.url || verified.metadata.filePath;
    const url = this.provider.getSignedUrl(source, this.config.playbackTtlSeconds);
    if (!/^https:\/\//i.test(String(url || ""))) throw providerError("voice_playback_failed", "The voice message could not be prepared for playback.");
    return { url, expiresInSeconds: this.config.playbackTtlSeconds };
  }

  async deleteOwnedAsset({ uid, conversationId, assetId }) {
    const verified = await this.verifyOwnedAsset({ uid, conversationId, assetId });
    if (verified.status === "already_absent") return verified;
    if (verified.status !== "verified") return verified;
    try {
      await this.provider.deleteFile(assetId);
      return { status: "deleted" };
    } catch (error) {
      if (Number(error?.statusCode || error?.status) === 404) return { status: "already_absent" };
      throw providerError("voice_delete_failed", "The voice message could not be deleted. Try again.");
    }
  }
}

module.exports = { VoiceMediaService, providerError };
