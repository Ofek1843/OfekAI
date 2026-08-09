export const VOICE_MIME_CANDIDATES = Object.freeze([
  "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus",
  "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"
]);

export const VOICE_RECORDER_ERRORS = Object.freeze({
  UNSUPPORTED: "voice_unsupported",
  PERMISSION_DENIED: "mic_permission_denied",
  START_FAILED: "recorder_start_failed",
  RECORDING_FAILED: "recording_failed",
  EMPTY: "recording_empty",
  CANCELLED: "recording_cancelled"
});

const VOICE_UPLOAD_MIME_TYPES = new Set(["audio/webm", "audio/ogg", "audio/mp4", "audio/x-m4a"]);

function voiceRecorderError(code) {
  const messages = {
    [VOICE_RECORDER_ERRORS.UNSUPPORTED]: "Voice recording is not supported in this browser.",
    [VOICE_RECORDER_ERRORS.PERMISSION_DENIED]: "Microphone access is blocked.",
    [VOICE_RECORDER_ERRORS.START_FAILED]: "Could not start voice recording.",
    [VOICE_RECORDER_ERRORS.RECORDING_FAILED]: "Voice recording failed.",
    [VOICE_RECORDER_ERRORS.EMPTY]: "The recording was empty.",
    [VOICE_RECORDER_ERRORS.CANCELLED]: "Voice recording was cancelled."
  };
  return Object.assign(new Error(messages[code] || messages[VOICE_RECORDER_ERRORS.RECORDING_FAILED]), { code });
}

export function normalizeVoiceMimeType(value) {
  const parts = String(value || "").trim().toLowerCase().split(";");
  const base = parts.shift()?.trim() || "";
  if (!base) return "";
  const parameters = parts.map((part) => part.trim().replace(/\s+/g, "")).filter(Boolean);
  return [base, ...parameters].join(";").slice(0, 120);
}

export function isVoiceUploadMimeType(value) {
  return VOICE_UPLOAD_MIME_TYPES.has(normalizeVoiceMimeType(value).split(";", 1)[0]);
}

export function getVoiceRecorderOptions(MediaRecorderClass = globalThis.MediaRecorder) {
  if (!MediaRecorderClass) return { supported: false, options: {}, requestedMimeType: "" };
  let requestedMimeType = "";
  if (typeof MediaRecorderClass.isTypeSupported === "function") {
    for (const candidate of VOICE_MIME_CANDIDATES) {
      try {
        if (MediaRecorderClass.isTypeSupported(candidate)) {
          requestedMimeType = candidate;
          break;
        }
      } catch {
        // A broken probe must not hide a usable browser-default recorder.
      }
    }
  }
  return {
    supported: true,
    options: requestedMimeType ? { mimeType: requestedMimeType } : {},
    requestedMimeType
  };
}

export function chooseVoiceMimeType(MediaRecorderClass = globalThis.MediaRecorder) {
  return getVoiceRecorderOptions(MediaRecorderClass).requestedMimeType;
}

export function resolveVoiceMimeType({ blobType = "", recorderMimeType = "", requestedMimeType = "" } = {}) {
  return normalizeVoiceMimeType(blobType || recorderMimeType || requestedMimeType);
}

export function createVoiceMediaRecorder(stream, MediaRecorderClass = globalThis.MediaRecorder) {
  const negotiation = getVoiceRecorderOptions(MediaRecorderClass);
  if (!negotiation.supported) throw voiceRecorderError(VOICE_RECORDER_ERRORS.UNSUPPORTED);
  if (negotiation.requestedMimeType) {
    try {
      return {
        recorder: new MediaRecorderClass(stream, negotiation.options),
        requestedMimeType: negotiation.requestedMimeType,
        usedDefaultFallback: false
      };
    } catch {
      // Safari can expose isTypeSupported() yet reject that option at construction.
    }
  }
  try {
    return {
      recorder: new MediaRecorderClass(stream),
      requestedMimeType: "",
      usedDefaultFallback: true
    };
  } catch {
    throw voiceRecorderError(VOICE_RECORDER_ERRORS.START_FAILED);
  }
}

export function formatVoiceDuration(milliseconds) {
  const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export class VoiceRecorderController {
  constructor({ mediaDevices = globalThis.navigator?.mediaDevices, MediaRecorderClass = globalThis.MediaRecorder, maxDurationMs = 120_000, now = () => Date.now(), setIntervalFn = globalThis.setInterval, clearIntervalFn = globalThis.clearInterval, onState = () => {} } = {}) {
    this.mediaDevices = mediaDevices;
    this.MediaRecorderClass = MediaRecorderClass;
    this.maxDurationMs = maxDurationMs;
    this.now = now;
    this.setIntervalFn = setIntervalFn;
    this.clearIntervalFn = clearIntervalFn;
    this.onState = onState;
    this.recorder = null;
    this.stream = null;
    this.chunks = [];
    this.startedAt = 0;
    this.timer = null;
    this.discard = false;
    this.stopPromise = null;
    this.resolveStop = null;
    this.stopReason = "member";
    this.requestedMimeType = "";
    this.usedDefaultFallback = false;
    this.errorCode = "";
    this.operationId = 0;
  }

  get supported() {
    return Boolean(this.mediaDevices?.getUserMedia && getVoiceRecorderOptions(this.MediaRecorderClass).supported);
  }

  async start() {
    if (!this.supported) throw voiceRecorderError(VOICE_RECORDER_ERRORS.UNSUPPORTED);
    if (this.recorder && this.recorder.state !== "inactive") return;
    const operationId = ++this.operationId;
    this.onState({ state: "requesting_mic" });
    let stream;
    try {
      // Permission is requested only here, directly from the microphone click.
      stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    } catch (error) {
      const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
      const normalized = voiceRecorderError(denied ? VOICE_RECORDER_ERRORS.PERMISSION_DENIED : VOICE_RECORDER_ERRORS.RECORDING_FAILED);
      this.onState({ state: "idle", errorCode: normalized.code });
      throw normalized;
    }
    if (operationId !== this.operationId) {
      for (const track of stream?.getTracks?.() || []) track.stop();
      throw voiceRecorderError(VOICE_RECORDER_ERRORS.CANCELLED);
    }
    this.stream = stream;
    this.chunks = [];
    this.discard = false;
    this.stopReason = "member";
    this.errorCode = "";
    this.onState({ state: "initializing_recorder" });
    try {
      const created = createVoiceMediaRecorder(this.stream, this.MediaRecorderClass);
      this.recorder = created.recorder;
      this.requestedMimeType = created.requestedMimeType;
      this.usedDefaultFallback = created.usedDefaultFallback;
    } catch (error) {
      this.releaseTracks();
      this.recorder = null;
      this.onState({ state: "idle", errorCode: error.code || VOICE_RECORDER_ERRORS.START_FAILED });
      throw error.code ? error : voiceRecorderError(VOICE_RECORDER_ERRORS.START_FAILED);
    }

    this.stopPromise = new Promise((resolve) => { this.resolveStop = resolve; });
    this.recorder.addEventListener("dataavailable", (event) => {
      if (event.data?.size) this.chunks.push(event.data);
    });
    this.recorder.addEventListener("start", () => {
      this.startedAt = this.now();
      this.timer = this.setIntervalFn(() => {
        const elapsedMs = this.now() - this.startedAt;
        this.onState({ state: "recording", elapsedMs, maxDurationMs: this.maxDurationMs });
        if (elapsedMs >= this.maxDurationMs) void this.stop("limit");
      }, 200);
      this.onState({
        state: "recording",
        elapsedMs: 0,
        maxDurationMs: this.maxDurationMs,
        defaultFallback: this.usedDefaultFallback,
        recorderMimeType: normalizeVoiceMimeType(this.recorder?.mimeType)
      });
    }, { once: true });
    this.recorder.addEventListener("error", () => {
      this.discard = true;
      this.errorCode = VOICE_RECORDER_ERRORS.RECORDING_FAILED;
      if (this.recorder?.state !== "inactive") void this.stop("error");
      else this.finalizeStop();
    });
    this.recorder.addEventListener("stop", () => this.finalizeStop(), { once: true });
    for (const track of this.stream.getTracks?.() || []) {
      track.addEventListener?.("ended", () => {
        if (this.recorder?.state === "recording") void this.stop("track-ended");
      }, { once: true });
    }
    try {
      // Omitting a timeslice supports Safari implementations that deliver useful
      // data primarily in the final dataavailable event triggered by stop().
      this.recorder.start();
    } catch {
      this.errorCode = VOICE_RECORDER_ERRORS.START_FAILED;
      this.discard = true;
      this.releaseTracks();
      this.clearTimer();
      this.recorder = null;
      this.resolveStop?.({ blob: null, durationMs: 0, mimeType: "", discarded: true, reason: "start-error" });
      this.resolveStop = null;
      this.onState({ state: "idle", errorCode: this.errorCode });
      throw voiceRecorderError(VOICE_RECORDER_ERRORS.START_FAILED);
    }
  }

  finalizeStop() {
    if (!this.resolveStop) return null;
    const recorder = this.recorder;
    const durationMs = this.startedAt
      ? Math.min(this.maxDurationMs, Math.max(0, this.now() - this.startedAt))
      : 0;
    const blobType = this.chunks.find((chunk) => String(chunk?.type || "").trim())?.type || "";
    const mimeType = resolveVoiceMimeType({
      blobType,
      recorderMimeType: recorder?.mimeType,
      requestedMimeType: this.requestedMimeType
    });
    let blob = null;
    if (!this.discard && this.chunks.length && isVoiceUploadMimeType(mimeType)) {
      const candidate = new Blob(this.chunks, { type: mimeType });
      if (candidate.size) blob = candidate;
    }
    const errorCode = this.errorCode || (!this.discard && !this.chunks.length
      ? VOICE_RECORDER_ERRORS.EMPTY
      : (!this.discard && !isVoiceUploadMimeType(mimeType) ? VOICE_RECORDER_ERRORS.RECORDING_FAILED : ""));
    this.releaseTracks();
    this.clearTimer();
    const result = {
      blob,
      durationMs,
      mimeType: blob?.type || mimeType,
      discarded: this.discard || !blob,
      reason: this.stopReason,
      errorCode
    };
    this.recorder = null;
    this.chunks = [];
    this.startedAt = 0;
    this.requestedMimeType = "";
    this.usedDefaultFallback = false;
    this.errorCode = "";
    const resolve = this.resolveStop;
    this.resolveStop = null;
    if (blob) this.onState({ state: "preview", ...result });
    else if (errorCode && this.stopReason !== "cancel") this.onState({ state: "error", ...result });
    else this.onState({ state: "idle", ...result });
    resolve?.(result);
    return result;
  }

  async stop(reason = "member") {
    if (!this.recorder) return this.stopPromise;
    const pending = this.stopPromise;
    if (this.recorder.state === "inactive") {
      if (this.resolveStop) this.finalizeStop();
      return pending;
    }
    this.stopReason = reason;
    this.onState({ state: "stopping", reason });
    try {
      this.recorder.stop();
    } catch {
      this.errorCode = VOICE_RECORDER_ERRORS.RECORDING_FAILED;
      this.discard = true;
      this.finalizeStop();
    }
    return pending;
  }

  async cancel() {
    this.operationId += 1;
    this.discard = true;
    if (this.recorder && this.recorder.state !== "inactive") return this.stop("cancel");
    if (this.recorder && this.resolveStop) return this.finalizeStop();
    this.releaseTracks();
    this.clearTimer();
    this.onState({ state: "idle", discarded: true });
    return { blob: null, discarded: true };
  }

  releaseTracks() {
    for (const track of this.stream?.getTracks?.() || []) track.stop();
    this.stream = null;
  }

  clearTimer() {
    if (this.timer) this.clearIntervalFn(this.timer);
    this.timer = null;
  }

  async dispose() {
    const pending = this.cancel();
    // Page teardown must release capture synchronously even if stop never fires.
    this.releaseTracks();
    await pending.catch(() => {});
    this.recorder = null;
    this.chunks = [];
  }
}

export class VoicePlaybackManager {
  constructor({ createAudio = (url) => new Audio(url), fetchPlayback } = {}) {
    this.createAudio = createAudio;
    this.fetchPlayback = fetchPlayback;
    this.active = null;
  }

  async play({ conversationId, messageId, onUpdate = () => {} }) {
    if (this.active?.messageId === messageId) {
      if (this.active.audio.paused) await this.active.audio.play(); else this.active.audio.pause();
      return;
    }
    this.stop();
    const playback = await this.fetchPlayback(conversationId, messageId);
    const audio = this.createAudio(playback.url);
    audio.preload = "metadata";
    const active = { audio, messageId, onUpdate };
    this.active = active;
    const update = () => {
      if (this.active !== active) return;
      onUpdate({ playing: !audio.paused, currentTime: Number(audio.currentTime || 0), duration: Number.isFinite(audio.duration) ? audio.duration : 0 });
    };
    for (const event of ["play", "pause", "timeupdate", "loadedmetadata", "durationchange", "ended"]) audio.addEventListener(event, update);
    audio.addEventListener("error", () => {
      if (this.active === active) { onUpdate({ playing: false, error: true, currentTime: 0, duration: 0 }); this.stop(); }
    });
    await audio.play();
    update();
  }

  seek(messageId, seconds) { if (this.active?.messageId === messageId) this.active.audio.currentTime = Math.max(0, Number(seconds || 0)); }
  stop() {
    if (!this.active) return;
    const active = this.active;
    this.active = null;
    active.audio.pause();
    active.audio.removeAttribute?.("src");
    active.audio.load?.();
    active.onUpdate?.({ playing: false, currentTime: 0, duration: 0 });
  }
}
