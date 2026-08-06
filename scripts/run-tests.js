#!/usr/bin/env node
//
// Deterministic test discovery for the full regression suite.
//
// Why this exists: package.json used to list every test file by hand. That
// list drifted -- ten *.test.js files existed in test/ and were never run by
// `npm test`, including whole suites for dashboard discoverability, meal
// image coverage, manual nutrition, nutrition targets, social profiles and
// language defaults. A test that exists but never executes is worse than no
// test, because it reads as coverage.
//
// Discovery is filesystem-driven, so adding test/<anything>.test.js is enough
// to get it running. Nothing has to be registered anywhere.
//
// Usage:
//   node scripts/run-tests.js              run everything (default)
//   node scripts/run-tests.js --standard   skip the emulator-backed suites
//   node scripts/run-tests.js --list       print what would run, run nothing

const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const TEST_DIR = path.join(ROOT, "test");

// Serial execution is deliberate and inherited from the previous command:
// several suites spawn a real server on a fixed port, so running files
// concurrently makes them fight over it.
const CONCURRENCY = "1";

// A suite needs the Firebase emulators if it talks to them. Detected from the
// file's own contents rather than a hand-maintained list, so a newly added
// emulator test is classified correctly without anyone remembering to.
const EMULATOR_MARKERS = [
  "@firebase/rules-unit-testing",
  "FIRESTORE_EMULATOR_HOST",
  "FIREBASE_AUTH_EMULATOR_HOST"
];

const REQUIRED_EMULATORS = [
  { name: "Firestore", host: "127.0.0.1", port: 8080 },
  { name: "Auth", host: "127.0.0.1", port: 9099 }
];

function discover(dir) {
  const found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...discover(full));
      continue;
    }
    // Only *.test.js. Shared helpers such as test/child-process-cleanup.js
    // are required BY tests and must never be handed to the runner.
    if (entry.isFile() && entry.name.endsWith(".test.js")) found.push(full);
  }
  // Sorted by POSIX-style relative path so the order is identical on every
  // platform and every run.
  return found.sort((a, b) => (relative(a) < relative(b) ? -1 : 1));
}

const relative = file => path.relative(ROOT, file).split(path.sep).join("/");

const needsEmulator = file => {
  const contents = fs.readFileSync(file, "utf8");
  return EMULATOR_MARKERS.some(marker => contents.includes(marker));
};

function probe({ host, port }, timeout = 1500) {
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

async function main() {
  const args = new Set(process.argv.slice(2));
  const standardOnly = args.has("--standard");
  const listOnly = args.has("--list");

  const all = discover(TEST_DIR);
  const emulator = all.filter(needsEmulator);
  const standard = all.filter(file => !emulator.includes(file));

  console.log(
    `Discovered ${all.length} test files ` +
      `(${standard.length} standard, ${emulator.length} emulator-backed).`
  );

  let selected = standardOnly ? standard : all;

  if (listOnly) {
    for (const file of selected) console.log("  " + relative(file));
    return 0;
  }

  if (!standardOnly && emulator.length > 0) {
    const missing = [];
    for (const service of REQUIRED_EMULATORS) {
      if (!(await probe(service))) missing.push(service);
    }

    if (missing.length > 0) {
      // Deliberately a failure, not a skip. Silently passing a suite that
      // never ran is how the drift above went unnoticed for so long.
      console.error(
        "\nERROR: these suites need the Firebase emulators, which are not reachable:\n" +
          emulator.map(file => "  " + relative(file)).join("\n") +
          "\n\nNot listening: " +
          missing.map(service => `${service.name} on ${service.host}:${service.port}`).join(", ") +
          "\n\nRun the whole suite with emulators started and cleaned up for you:\n" +
          "  npm run test:with-emulators\n\n" +
          "Or run just the suites that do not need them:\n" +
          "  node scripts/run-tests.js --standard\n"
      );
      return 1;
    }
  }

  console.log(`Running ${selected.length} test files serially...\n`);

  const child = spawn(
    process.execPath,
    ["--test", `--test-concurrency=${CONCURRENCY}`, ...selected.map(relative)],
    { cwd: ROOT, stdio: "inherit" }
  );

  return new Promise(resolve => {
    child.on("close", (code, signal) => resolve(signal ? 1 : code ?? 1));
  });
}

main()
  .then(code => process.exit(code))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
