"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { spawn, spawnSync } = require("node:child_process");
const net = require("node:net");
const { stopChildProcess } = require("./child-process-cleanup");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const { assertProductionRuntime } = require("../lib/production-runtime-policy");
const root = path.join(__dirname, "..");
const unsafeSettings = {
  MOCK_EXTERNAL_SERVICES: "true",
  FUELPHYSIQUE_LOCAL_DEMO: "1",
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9099",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
  FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  STORAGE_EMULATOR_HOST: "http://127.0.0.1:9199"
};

for (const marker of [{ NODE_ENV: "production" }, { NODE_ENV: "development", RENDER: "true" }]) {
  for (const [name, value] of Object.entries(unsafeSettings)) {
    test(`${JSON.stringify(marker)} rejects ${name}`, () => {
      assert.throws(() => assertProductionRuntime({ ...marker, [name]: value }), error => {
        assert.match(error.message, /Unsafe production configuration/);
        assert.ok(error.message.includes(name));
        if (value.includes(":")) assert.ok(!error.message.includes(value));
        return true;
      });
    });
  }
}

test("real production config, disabled flags and local test/emulator workflows remain valid", () => {
  for (const env of [
    { NODE_ENV: "production", MOCK_EXTERNAL_SERVICES: "false", FUELPHYSIQUE_LOCAL_DEMO: "0" },
    { RENDER: "true" },
    { NODE_ENV: "test", ...unsafeSettings },
    { ...unsafeSettings },
    { NODE_ENV: "test", RENDER_GIT_COMMIT: "test-build-sha", MOCK_EXTERNAL_SERVICES: "true" }
  ]) assert.doesNotThrow(() => assertProductionRuntime(env));
  assert.throws(() => assertProductionRuntime({ NODE_ENV: " Production ", MOCK_EXTERNAL_SERVICES: "TRUE" }));
  assert.throws(() => assertProductionRuntime({ RENDER: "TRUE", FIRESTORE_EMULATOR_HOST: " " }));
});

test("actual server refuses mock authentication before initializing Firebase or listening", () => {
  const result = spawnSync(process.execPath, ["server.js"], {
    cwd: root, encoding: "utf8", timeout: 15000,
    env: { ...process.env, NODE_ENV: "production", MOCK_EXTERNAL_SERVICES: "true", DOTENV_CONFIG_QUIET: "true" }
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unsafe production configuration:.*MOCK_EXTERNAL_SERVICES/);
  assert.doesNotMatch(result.stdout, /listening|server running/i);
});

test("all Admin SDK consumers enforce the policy before reusing an existing application", () => {
  const source = fs.readFileSync(path.join(root, "lib/firebase-admin.js"), "utf8");
  for (const getter of ["getFuelPhysiqueFirestore", "getFuelPhysiqueAuth", "getFuelPhysiqueStorage", "getFuelPhysiqueMessaging"]) {
    let sdkCalls = 0;
    const sandbox = {
      module: { exports: {} }, process: { env: {} },
      require(name) {
        if (name === "./production-runtime-policy") return { assertProductionRuntime: () => {
          assertProductionRuntime({ NODE_ENV: "production", FIRESTORE_EMULATOR_HOST: "localhost:8080" });
        } };
        if (name === "firebase-admin/app") return { getApps: () => { sdkCalls++; return [{}]; } };
        return new Proxy({}, { get: () => () => { sdkCalls++; } });
      }
    };
    vm.runInNewContext(source, sandbox);
    assert.throws(() => sandbox.module.exports[getter](), /Unsafe production configuration/);
    assert.equal(sdkCalls, 0, getter);
  }
});

test("safe production server starts and still rejects unauthenticated protected requests", async t => {
  const reserve = net.createServer();
  await new Promise(resolve => reserve.listen(0, "127.0.0.1", resolve));
  const port = reserve.address().port;
  await new Promise(resolve => reserve.close(resolve));
  const env = {
    ...process.env, NODE_ENV: "production", RENDER: "true", PORT: String(port), SERVER_BIND_HOST: "127.0.0.1",
    MOCK_EXTERNAL_SERVICES: "false", FUELPHYSIQUE_LOCAL_DEMO: "0", TELEGRAM_MONITOR_ENABLED: "false",
    PUSH_NOTIFICATIONS_ENABLED: "false"
  };
  for (const name of Object.keys(unsafeSettings).filter(name => name.includes("EMULATOR"))) env[name] = "";
  const child = spawn(process.execPath, ["server.js"], { cwd: root, env, stdio: "ignore" });
  t.after(() => stopChildProcess(child));
  const base = `http://127.0.0.1:${port}`;
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(base + "/health")).ok) { ready = true; break; } } catch {}
    if (child.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  assert.equal(ready, true, "production health becomes ready without test authentication");
  const response = await fetch(base + "/api/imagekit/upload-auth", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ purpose: "profile", mimeType: "image/png" })
  });
  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /Authentication is required/);
});
