"use strict";

const autocannon = require("autocannon");
const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const configuredTarget = process.env.LOAD_TEST_URL;

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function stopTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    try {
      require("node:child_process").execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // The process exited between the check and the termination request.
    }
    return;
  }
  child.kill("SIGTERM");
}

async function waitForHealth(target, child) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Local load-test server exited before becoming healthy.");
    try {
      const response = await fetch(`${target}/health`);
      if (response.ok) return;
    } catch {
      // The process may still be binding the test port.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Local load-test server did not become healthy within 30 seconds.");
}

async function startLocalServer() {
  const port = await findOpenPort();
  const target = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: String(port),
      MOCK_EXTERNAL_SERVICES: "true",
      FUELPHYSIQUE_LOCAL_DEMO: "1",
      OPENAI_API_KEY: "test-key-not-used-in-mock-mode"
    },
    stdio: "ignore"
  });
  await waitForHealth(target, child);
  return { child, target };
}

function run(name, opts) {
  return new Promise((resolve, reject) => {
    const instance = autocannon(opts, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ name, result });
    });
    autocannon.track(instance, { renderProgressBar: false });
  });
}

function summarize(result) {
  return {
    requests: result.requests.average,
    throughput: result.throughput.average,
    latency: {
      p50: result.latency.p50,
      p95: result.latency.p95,
      p99: result.latency.p99
    },
    errors: result.errors,
    timeouts: result.timeouts,
    non2xx: result.non2xx,
    maxRssMb: Math.round((process.resourceUsage().maxRSS || 0) / 1024)
  };
}

async function main() {
  const local = configuredTarget ? null : await startLocalServer();
  const target = configuredTarget || local.target;
  const runs = [
    run("static-10", { url: `${target}/`, connections: 10, duration: 10 }),
    run("static-25", { url: `${target}/`, connections: 25, duration: 10 }),
    run("health-25", { url: `${target}/health`, connections: 25, duration: 10 })
  ];

  try {
    const results = await Promise.all(runs);
    const summary = results.map(item => ({ name: item.name, ...summarize(item.result) }));
    const failed = summary.filter(item => item.requests <= 0 || item.errors > 0 || item.timeouts > 0 || item.non2xx > 0);
    console.log(JSON.stringify({ target, results: summary }, null, 2));
    if (failed.length) throw new Error(`Load validation failed: ${failed.map(item => item.name).join(", ")}.`);
  } finally {
    stopTree(local?.child);
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
