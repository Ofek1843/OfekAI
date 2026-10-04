const { execFileSync } = require("node:child_process");

function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  // The test servers are direct Node children and do not spawn workers.
  // Terminate the exact child through Node first; taskkill /T can block the
  // test runner on Windows even after the server has stopped listening.
  try {
    if (child.kill()) return;
  } catch {
    // Fall through to the Windows process-tree fallback below.
  }

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
