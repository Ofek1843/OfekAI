"use strict";

// Reuse the owner-aware harness used by the complete suite. The older
// firebase emulators:exec wrapper could leave a Java child alive on Windows,
// making the next isolated run fail with a false "port occupied" result.
const path = require("node:path");
const { spawn } = require("node:child_process");

const child = spawn(process.execPath, [
  path.join(__dirname, "run-tests-with-emulators.js"),
  "--file=test/firestore-rules-emulator.test.js"
], { cwd: path.join(__dirname, ".."), stdio: "inherit" });

child.on("close", (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1;
});
