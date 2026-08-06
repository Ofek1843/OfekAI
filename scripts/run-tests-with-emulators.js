#!/usr/bin/env node
//
// Runs the complete regression suite with the Firebase emulators started,
// waited for, and torn down afterwards.
//
// Why this exists: two suites (test/firestore-rules-emulator.test.js and
// test/social-two-user-journey.test.js) need the Auth and Firestore
// emulators. Previously `npm test` simply assumed they were already running,
// so on a clean machine those suites failed at connect time with an error
// that pointed at nothing actionable.
//
// This uses the repository's existing emulator configuration
// (firebase.local.json, project demo-fuelphysique) and the same firebase-tools
// pin as the existing test:firestore:emulator script. Synthetic local data
// only -- the demo- project prefix makes the Firebase SDK refuse to contact
// production, so no real service can be reached from here.
//
// Usage:
//   node scripts/run-tests-with-emulators.js            full suite
//   node scripts/run-tests-with-emulators.js --standard skip emulator suites

const net = require("node:net");
const path = require("node:path");
const { spawn } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const FIREBASE_TOOLS = "firebase-tools@13.35.1";
const PROJECT = "demo-fuelphysique";

const SERVICES = [
  { name: "Firestore", host: "127.0.0.1", port: 8080 },
  { name: "Auth", host: "127.0.0.1", port: 9099 }
];

const READY_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 500;

function probe({ host, port }, timeout = 1000) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    const done = ok => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

const allUp = async () => (await Promise.all(SERVICES.map(service => probe(service)))).every(Boolean);

// Windows does not propagate a kill to a process tree, and firebase-tools
// spawns Java children for the Firestore emulator. Without taskkill /T those
// keep the ports bound after this script exits, so the next run fails with
// "port taken". Mirrors test/child-process-cleanup.js.
function stopTree(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === "win32") {
    try {
      require("node:child_process").execFileSync(
        "taskkill",
        ["/PID", String(child.pid), "/T", "/F"],
        { stdio: "ignore" }
      );
    } catch {
      // Already gone between the check and the kill.
    }
    return;
  }
  child.kill("SIGTERM");
}

async function main() {
  const passthrough = process.argv.slice(2);

  // Never start a second copy on top of emulators the developer is already
  // running -- that is the "port taken" failure, and their data may be in use.
  const alreadyRunning = await allUp();
  let emulators = null;

  if (alreadyRunning) {
    console.log("Emulators already listening on 8080/9099 -- reusing them.\n");
  } else {
    for (const service of SERVICES) {
      if (await probe(service)) {
        console.error(
          `ERROR: ${service.name}'s port ${service.port} is occupied but the other ` +
            `emulator is not up.\nStop whatever is holding it and retry.`
        );
        return 1;
      }
    }

    console.log(`Starting Auth + Firestore emulators (project ${PROJECT})...`);
    // Node refuses to spawn .cmd/.bat directly on Windows (EINVAL) since the
    // 18.20/20.12 argument-injection fix, and npx is a .cmd shim there.
    // Going through cmd.exe /c explicitly avoids that without `shell: true`,
    // which would trigger the DEP0190 unescaped-arguments warning. taskkill
    // /T below reaps the whole tree, cmd.exe and the Java children included.
    const onWindows = process.platform === "win32";
    const npxArgs = [
      "--yes", FIREBASE_TOOLS, "emulators:start",
      "--config", "firebase.local.json",
      "--project", PROJECT,
      "--only", "auth,firestore"
    ];
    emulators = spawn(
      onWindows ? "cmd.exe" : "npx",
      onWindows ? ["/c", "npx", ...npxArgs] : npxArgs,
      { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] }
    );

    let emulatorFailed = null;
    emulators.stderr.on("data", chunk => {
      const text = String(chunk);
      if (/port taken|Could not start/i.test(text)) emulatorFailed = text.trim();
    });
    emulators.on("exit", code => {
      if (code !== 0 && !emulatorFailed) emulatorFailed = `emulators exited with code ${code}`;
    });

    // Poll for real readiness rather than sleeping a fixed amount: the JVM
    // start-up time varies enormously between machines.
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let ready = false;
    while (Date.now() < deadline) {
      if (emulatorFailed) break;
      if (await allUp()) {
        ready = true;
        break;
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }

    if (!ready) {
      stopTree(emulators);
      console.error(
        "\nERROR: the Firebase emulators did not become ready.\n" +
          (emulatorFailed ? `\n${emulatorFailed}\n` : "") +
          "\nThe Firestore emulator needs a Java runtime on PATH. Check with:\n" +
          "  java -version\n"
      );
      return 1;
    }
    console.log("Emulators ready.\n");
  }

  const env = {
    ...process.env,
    FIREBASE_AUTH_EMULATOR_HOST: process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099",
    FIRESTORE_EMULATOR_HOST: process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080",
    GCLOUD_PROJECT: process.env.GCLOUD_PROJECT || PROJECT
  };

  const runner = spawn(process.execPath, [path.join(__dirname, "run-tests.js"), ...passthrough], {
    cwd: ROOT,
    stdio: "inherit",
    env
  });

  const exitCode = await new Promise(resolve => {
    runner.on("close", (code, signal) => resolve(signal ? 1 : code ?? 1));
  });

  // Only tear down what this script started.
  if (emulators) {
    console.log("\nStopping emulators...");
    stopTree(emulators);
    await new Promise(resolve => setTimeout(resolve, 1000));
    const stillUp = await allUp();
    console.log(stillUp ? "WARNING: an emulator port is still bound." : "Emulators stopped.");
  }

  return exitCode;
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
