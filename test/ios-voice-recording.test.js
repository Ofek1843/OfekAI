const test = require("node:test");
const assert = require("node:assert/strict");

function streamFixture() {
  const trackListeners = new Map();
  const track = {
    stopped: 0,
    stop() { this.stopped += 1; },
    addEventListener(name, listener) { trackListeners.set(name, listener); }
  };
  return { stream: { getTracks: () => [track] }, track, trackListeners };
}

function recorderClass({ supported = () => false, mimeType = "audio/mp4", rejectExplicit = false, rejectDefault = false, startThrows = false } = {}) {
  class FakeRecorder {
    static constructions = [];
    static instance = null;
    static isTypeSupported(value) { return supported(value); }
    constructor(stream, options) {
      FakeRecorder.constructions.push(options);
      if (options?.mimeType && rejectExplicit) throw new DOMException("Rejected", "NotSupportedError");
      if (!options && rejectDefault) throw new DOMException("Rejected", "NotSupportedError");
      this.stream = stream;
      this.mimeType = mimeType;
      this.state = "inactive";
      this.listeners = new Map();
      FakeRecorder.instance = this;
    }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    start(...args) {
      if (startThrows) throw new DOMException("Cannot start", "NotSupportedError");
      this.startArguments = args;
      this.state = "recording";
      this.listeners.get("start")?.();
    }
    stop() {
      this.state = "inactive";
      this.listeners.get("dataavailable")?.({ data: new Blob([Buffer.from("recorded")], { type: this.mimeType }) });
      this.listeners.get("stop")?.();
    }
  }
  return FakeRecorder;
}

test("Chromium selects an explicit WebM/Opus recorder", async () => {
  const { createVoiceMediaRecorder } = await import("../public/js/voice-message-client.mjs");
  const FakeRecorder = recorderClass({ supported: (type) => type === "audio/webm;codecs=opus", mimeType: "audio/webm;codecs=opus" });
  const created = createVoiceMediaRecorder(streamFixture().stream, FakeRecorder);
  assert.equal(created.requestedMimeType, "audio/webm;codecs=opus");
  assert.equal(created.usedDefaultFallback, false);
  assert.deepEqual(FakeRecorder.constructions, [{ mimeType: "audio/webm;codecs=opus" }]);
});

test("iOS-like recorder works through browser default when every preferred MIME probe is false", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  const fixture = streamFixture();
  const FakeRecorder = recorderClass({ mimeType: "audio/mp4" });
  const states = [];
  let now = 1_000;
  const controller = new VoiceRecorderController({
    mediaDevices: { async getUserMedia() { return fixture.stream; } },
    MediaRecorderClass: FakeRecorder,
    now: () => now,
    onState: (state) => states.push(state)
  });
  assert.equal(controller.supported, true);
  await controller.start();
  assert.deepEqual(FakeRecorder.constructions, [undefined]);
  assert.deepEqual(FakeRecorder.instance.startArguments, []);
  now = 2_000;
  const result = await controller.stop();
  assert.equal(result.mimeType, "audio/mp4");
  assert.equal(result.blob.type, "audio/mp4");
  assert.equal(result.blob.size, 8);
  assert.equal(fixture.track.stopped, 1);
  assert.equal(states.some((state) => state.state === "recording" && state.defaultFallback === true), true);
});

test("explicit constructor rejection falls back to the browser-default constructor", async () => {
  const { createVoiceMediaRecorder } = await import("../public/js/voice-message-client.mjs");
  const FakeRecorder = recorderClass({ supported: (type) => type === "audio/mp4", rejectExplicit: true });
  const created = createVoiceMediaRecorder(streamFixture().stream, FakeRecorder);
  assert.equal(created.usedDefaultFallback, true);
  assert.deepEqual(FakeRecorder.constructions, [{ mimeType: "audio/mp4" }, undefined]);
});

test("missing MediaRecorder is genuinely unsupported without requesting permission", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  let requests = 0;
  const controller = new VoiceRecorderController({
    mediaDevices: { async getUserMedia() { requests += 1; } },
    MediaRecorderClass: null
  });
  assert.equal(controller.supported, false);
  await assert.rejects(() => controller.start(), (error) => error.code === "voice_unsupported");
  assert.equal(requests, 0);
});

test("NotAllowedError maps to stable microphone permission denial", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  const FakeRecorder = recorderClass({ supported: (type) => type === "audio/mp4" });
  const controller = new VoiceRecorderController({
    mediaDevices: { async getUserMedia() { throw new DOMException("Denied", "NotAllowedError"); } },
    MediaRecorderClass: FakeRecorder
  });
  await assert.rejects(() => controller.start(), (error) => error.code === "mic_permission_denied" && !error.message.includes("Denied"));
  assert.equal(FakeRecorder.constructions.length, 0);
});

test("explicit and default constructor failure releases every acquired track", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  const fixture = streamFixture();
  const FakeRecorder = recorderClass({ supported: (type) => type === "audio/mp4", rejectExplicit: true, rejectDefault: true });
  const controller = new VoiceRecorderController({
    mediaDevices: { async getUserMedia() { return fixture.stream; } },
    MediaRecorderClass: FakeRecorder
  });
  await assert.rejects(() => controller.start(), (error) => error.code === "recorder_start_failed");
  assert.equal(fixture.track.stopped, 1);
  assert.equal(controller.stream, null);
});

test("a synchronous recorder.start failure releases the microphone stream", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  const fixture = streamFixture();
  const FakeRecorder = recorderClass({ supported: (type) => type === "audio/mp4", startThrows: true });
  const controller = new VoiceRecorderController({
    mediaDevices: { async getUserMedia() { return fixture.stream; } },
    MediaRecorderClass: FakeRecorder
  });
  await assert.rejects(() => controller.start(), (error) => error.code === "recorder_start_failed");
  assert.equal(fixture.track.stopped, 1);
  assert.equal(controller.stream, null);
});

test("conversation exit while permission is pending discards and stops the late stream", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  const fixture = streamFixture();
  const FakeRecorder = recorderClass({ supported: (type) => type === "audio/mp4" });
  let resolvePermission;
  const controller = new VoiceRecorderController({
    mediaDevices: { getUserMedia() { return new Promise((resolve) => { resolvePermission = resolve; }); } },
    MediaRecorderClass: FakeRecorder
  });
  const starting = controller.start();
  await controller.cancel();
  resolvePermission(fixture.stream);
  await assert.rejects(() => starting, (error) => error.code === "recording_cancelled");
  assert.equal(fixture.track.stopped, 1);
  assert.equal(FakeRecorder.constructions.length, 0);
});

test("final-only dataavailable produces a valid preview after stop ordering completes", async () => {
  const { VoiceRecorderController } = await import("../public/js/voice-message-client.mjs");
  const fixture = streamFixture();
  const order = [];
  class FinalOnlyRecorder {
    static isTypeSupported(type) { return type === "audio/mp4"; }
    constructor() { this.state = "inactive"; this.mimeType = "audio/mp4;codecs=mp4a.40.2"; this.listeners = new Map(); }
    addEventListener(name, listener) { this.listeners.set(name, listener); }
    start() { this.state = "recording"; this.listeners.get("start")?.(); }
    stop() {
      this.state = "inactive";
      order.push("stop-called");
      this.listeners.get("dataavailable")?.({ data: new Blob(["final"], { type: "audio/mp4" }) });
      order.push("dataavailable");
      this.listeners.get("stop")?.();
      order.push("stop-event");
    }
  }
  const controller = new VoiceRecorderController({ mediaDevices: { async getUserMedia() { return fixture.stream; } }, MediaRecorderClass: FinalOnlyRecorder, now: () => 1_000 });
  await controller.start();
  const result = await controller.stop();
  assert.deepEqual(order, ["stop-called", "dataavailable", "stop-event"]);
  assert.equal(result.blob.size, 5);
  assert.equal(result.mimeType, "audio/mp4");
});

test("Blob type wins, then recorder MIME, then requested MIME during resolution", async () => {
  const { resolveVoiceMimeType } = await import("../public/js/voice-message-client.mjs");
  assert.equal(resolveVoiceMimeType({ blobType: "audio/mp4", recorderMimeType: "audio/webm", requestedMimeType: "audio/ogg" }), "audio/mp4");
  assert.equal(resolveVoiceMimeType({ blobType: "", recorderMimeType: "audio/mp4; codecs=mp4a.40.2", requestedMimeType: "audio/webm" }), "audio/mp4;codecs=mp4a.40.2");
  assert.equal(resolveVoiceMimeType({ blobType: "", recorderMimeType: "", requestedMimeType: "audio/webm;codecs=opus" }), "audio/webm;codecs=opus");
});
