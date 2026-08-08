const test = require("node:test");
const assert = require("node:assert/strict");

test("voice client chooses an interoperable supported format and formats duration", async () => {
  const { chooseVoiceMimeType, formatVoiceDuration } = await import("../public/js/voice-message-client.mjs");
  const MediaRecorderClass = { isTypeSupported: (value) => value === "audio/webm;codecs=opus" };
  assert.equal(chooseVoiceMimeType(MediaRecorderClass), "audio/webm;codecs=opus");
  assert.equal(formatVoiceDuration(0), "0:00");
  assert.equal(formatVoiceDuration(65_000), "1:05");
});

test("recorder support is false without microphone APIs and no permission is requested by construction", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  let requests = 0;
  const recorder = new VoiceRecorderController({ mediaDevices: { async getUserMedia() { requests += 1; } }, MediaRecorderClass: null });
  assert.equal(recorder.supported, false);
  assert.equal(requests, 0);
  await assert.rejects(() => recorder.start(), error => error.code === "voice_unsupported");
  assert.equal(requests, 0);
});

test("microphone permission denial is surfaced without constructing a recorder", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  let recorderConstructions = 0;
  class FakeRecorder {
    static isTypeSupported(type) { return type === "audio/mp4"; }
    constructor() { recorderConstructions += 1; }
  }
  const denied = Object.assign(new Error("Permission denied"), { name: "NotAllowedError" });
  const controller = new VoiceRecorderController({
    mediaDevices: { async getUserMedia() { throw denied; } },
    MediaRecorderClass: FakeRecorder
  });
  await assert.rejects(() => controller.start(), error => error === denied);
  assert.equal(recorderConstructions, 0);
  assert.equal(controller.stream, null);
});

test("playback manager enforces one active player and fetches authorization per new message", async () => {
  const { VoicePlaybackManager } = await import("../public/js/voice-message-client.mjs");
  const players = [];
  const fetched = [];
  const createAudio = (url) => {
    const listeners = new Map();
    const audio = { url, paused: true, currentTime: 0, duration: 2, addEventListener(name, fn) { listeners.set(name, fn); }, async play() { this.paused = false; listeners.get("play")?.(); }, pause() { this.paused = true; listeners.get("pause")?.(); }, removeAttribute() {}, load() {} };
    players.push(audio);
    return audio;
  };
  const manager = new VoicePlaybackManager({ createAudio, fetchPlayback: async (conversationId, messageId) => { fetched.push([conversationId, messageId]); return { url: `https://signed/${messageId}` }; } });
  await manager.play({ conversationId: "c", messageId: "m1" });
  await manager.play({ conversationId: "c", messageId: "m2" });
  assert.deepEqual(fetched, [["c", "m1"], ["c", "m2"]]);
  assert.equal(players[0].paused, true);
  assert.equal(players[1].paused, false);
});

test("recording permission is requested only by start, stop releases every track, and preview stays in memory", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  const listeners = new Map();
  const track = { stopped: 0, stop() { this.stopped += 1; }, addEventListener(name, fn) { listeners.set(`track:${name}`, fn); } };
  const stream = { getTracks: () => [track] };
  let permissionRequests = 0;
  class FakeRecorder {
    static isTypeSupported(type) { return type === "audio/webm;codecs=opus"; }
    constructor() { this.state = "inactive"; this.mimeType = "audio/webm;codecs=opus"; this.listeners = new Map(); }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    start() { this.state = "recording"; }
    stop() {
      this.state = "inactive";
      this.listeners.get("dataavailable")?.({ data: new Blob([Buffer.from("voice")], { type: this.mimeType }) });
      this.listeners.get("stop")?.();
    }
  }
  let now = 1000;
  const states = [];
  const controller = new VoiceRecorderController({ mediaDevices: { async getUserMedia() { permissionRequests += 1; return stream; } }, MediaRecorderClass: FakeRecorder, now: () => now, onState: (value) => states.push(value) });
  assert.equal(permissionRequests, 0);
  await controller.start();
  assert.equal(permissionRequests, 1);
  now = 2500;
  const result = await controller.stop();
  assert.equal(result.durationMs, 1500);
  assert.equal(result.blob.size, 5);
  assert.equal(track.stopped >= 1, true);
  assert.equal(states.at(-1).state, "preview");
});

test("microphone track interruption stops recording safely and recorder errors discard audio", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  function setup() {
    const trackListeners = new Map();
    const track = { stop() {}, addEventListener(name, fn) { trackListeners.set(name, fn); } };
    class FakeRecorder {
      static isTypeSupported(type) { return type === "audio/mp4"; }
      constructor() { this.state = "inactive"; this.mimeType = "audio/mp4"; this.listeners = new Map(); setup.instance = this; }
      addEventListener(name, fn) { this.listeners.set(name, fn); }
      start() { this.state = "recording"; }
      stop() { this.state = "inactive"; this.listeners.get("stop")?.(); }
    }
    const states = [];
    return { trackListeners, states, controller: new VoiceRecorderController({ mediaDevices: { async getUserMedia() { return { getTracks: () => [track] }; } }, MediaRecorderClass: FakeRecorder, now: () => 1000, onState: value => states.push(value) }), FakeRecorder };
  }
  const ended = setup();
  await ended.controller.start();
  ended.trackListeners.get("ended")();
  const endedResult = await ended.controller.stopPromise;
  assert.equal(endedResult.reason, "track-ended");

  const errored = setup();
  await errored.controller.start();
  setup.instance.listeners.get("error")({ error: new Error("mic lost") });
  const errorResult = await errored.controller.stopPromise;
  assert.equal(errorResult.discarded, true);
  assert.equal(errored.states.some(value => value.state === "error"), true);
});

test("recording stops automatically at the configured duration limit using a deterministic timer", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  let timerCallback;
  let clearedTimer;
  let now = 1_000;
  class FakeRecorder {
    static isTypeSupported(type) { return type === "audio/webm"; }
    constructor() { this.state = "inactive"; this.mimeType = "audio/webm"; this.listeners = new Map(); }
    addEventListener(name, fn) { this.listeners.set(name, fn); }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.listeners.get("stop")?.(); }
  }
  const controller = new VoiceRecorderController({
    mediaDevices: { async getUserMedia() { return { getTracks: () => [] }; } },
    MediaRecorderClass: FakeRecorder,
    maxDurationMs: 1_000,
    now: () => now,
    setIntervalFn(callback) { timerCallback = callback; return 77; },
    clearIntervalFn(timer) { clearedTimer = timer; }
  });
  await controller.start();
  now = 2_500;
  timerCallback();
  const result = await controller.stopPromise;
  assert.equal(result.durationMs, 1_000);
  assert.equal(result.reason, "limit");
  assert.equal(clearedTimer, 77);
});
