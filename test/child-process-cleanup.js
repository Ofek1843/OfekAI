const { execFileSync } = require("node:child_process");

function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // The child may have exited between the state check and taskkill.
    }
    return;
  }

  child.kill("SIGTERM");
}

module.exports = { stopChildProcess };
