export const VOICE_MIME_CANDIDATES = Object.freeze([
  "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus",
  "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"
]);

export function chooseVoiceMimeType(MediaRecorderClass = globalThis.MediaRecorder) {
  if (!MediaRecorderClass) return "";
  return VOICE_MIME_CANDIDATES.find((type) => MediaRecorderClass.isTypeSupported?.(type)) || "";
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
    this.stopReason = "member";
  }

  get supported() { return Boolean(this.mediaDevices?.getUserMedia && chooseVoiceMimeType(this.MediaRecorderClass)); }

  async start() {
    if (!this.supported) throw Object.assign(new Error("Voice recording is not supported in this browser."), { code: "voice_unsupported" });
    if (this.recorder?.state === "recording") return;
    const mimeType = chooseVoiceMimeType(this.MediaRecorderClass);
    // Permission is requested only here, directly from the microphone click.
    this.stream = await this.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    this.chunks = [];
    this.discard = false;
    this.stopReason = "member";
    try {
      this.recorder = new this.MediaRecorderClass(this.stream, { mimeType });
    } catch (error) {
      this.releaseTracks();
      this.onState({ state: "error", error });
      throw error;
    }
    this.recorder.addEventListener("dataavailable", (event) => { if (event.data?.size) this.chunks.push(event.data); });
    this.recorder.addEventListener("error", (event) => {
      this.discard = true;
      this.onState({ state: "error", error: event.error });
      if (this.recorder?.state === "recording") void this.stop("error");
      else this.releaseTracks();
    });
    for (const track of this.stream.getTracks?.() || []) {
      track.addEventListener?.("ended", () => {
        if (this.recorder?.state === "recording") void this.stop("track-ended");
      }, { once: true });
    }
    this.stopPromise = new Promise((resolve) => {
      this.recorder.addEventListener("stop", () => {
        const durationMs = Math.min(this.maxDurationMs, Math.max(0, this.now() - this.startedAt));
        const blob = this.discard ? null : new Blob(this.chunks, { type: this.recorder.mimeType || mimeType });
        this.releaseTracks();
        this.clearTimer();
        const result = { blob, durationMs, mimeType: blob?.type || mimeType, discarded: this.discard, reason: this.stopReason };
        this.onState({ state: this.discard ? "idle" : "preview", ...result });
        resolve(result);
      }, { once: true });
    });
    this.startedAt = this.now();
    this.recorder.start(250);
    this.timer = this.setIntervalFn(() => {
      const elapsedMs = this.now() - this.startedAt;
      this.onState({ state: "recording", elapsedMs, maxDurationMs: this.maxDurationMs });
      if (elapsedMs >= this.maxDurationMs) void this.stop("limit");
    }, 200);
    this.onState({ state: "recording", elapsedMs: 0, maxDurationMs: this.maxDurationMs });
  }

  async stop(reason = "member") {
    if (!this.recorder || this.recorder.state === "inactive") return this.stopPromise;
    this.stopReason = reason;
    this.onState({ state: "stopping", reason });
    this.recorder.stop();
    this.releaseTracks();
    return this.stopPromise;
  }

  async cancel() {
    this.discard = true;
    if (this.recorder && this.recorder.state !== "inactive") return this.stop("cancel");
    this.releaseTracks();
    this.clearTimer();
    this.onState({ state: "idle", discarded: true });
    return { blob: null, discarded: true };
  }

  releaseTracks() { for (const track of this.stream?.getTracks?.() || []) track.stop(); this.stream = null; }
  clearTimer() { if (this.timer) this.clearIntervalFn(this.timer); this.timer = null; }
  async dispose() { await this.cancel(); this.recorder = null; this.chunks = []; }
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
    for (const event of ["play", "pause", "timeupdate", "loadedmetadata", "ended"]) audio.addEventListener(event, update);
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
