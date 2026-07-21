"use strict";

const autocannon = require("autocannon");

const target = process.env.LOAD_TEST_URL || "http://localhost:3000";

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
  const runs = [
    run("static-10", { url: `${target}/`, connections: 10, duration: 10 }),
    run("static-25", { url: `${target}/`, connections: 25, duration: 10 }),
    run("health-25", { url: `${target}/health`, connections: 25, duration: 10 }),
    run("exercise-demo", { url: `${target}/api/exercise-demo?name=Squat`, connections: 10, duration: 10 })
  ];

  const results = await Promise.all(runs);
  console.log(JSON.stringify({
    target,
    results: results.map(item => ({ name: item.name, ...summarize(item.result) }))
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
