"use strict";

const crypto = require("crypto");

function createTtlCache({ maxEntries = 100, ttlMs = 60 * 60 * 1000 } = {}) {
  const store = new Map();

  function purgeExpired(now = Date.now()) {
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) store.delete(key);
    }
  }

  return {
    get(key) {
      purgeExpired();
      const entry = store.get(key);
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },
    set(key, value, customTtlMs = ttlMs) {
      purgeExpired();
      while (store.size >= maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
      store.set(key, { value, expiresAt: Date.now() + customTtlMs });
    },
    has(key) {
      return this.get(key) !== undefined;
    },
    delete(key) {
      return store.delete(key);
    },
    clear() {
      store.clear();
    },
    size() {
      purgeExpired();
      return store.size;
    }
  };
}

function clientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.ip || req.socket?.remoteAddress || "unknown";
}

function createRateLimiter({ windowMs = 60_000, max = 10, keyPrefix = "limit" } = {}) {
  const buckets = new Map();

  return function checkRateLimit(req, identity = "anonymous") {
    const key = `${keyPrefix}:${identity}:${clientIp(req)}`;
    const now = Date.now();
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs };

    if (bucket.resetAt <= now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }

    bucket.count += 1;
    buckets.set(key, bucket);

    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }

    if (bucket.count > max) {
      const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      const error = new Error("RATE_LIMITED");
      error.status = 429;
      error.retryAfterSeconds = retryAfterSeconds;
      throw error;
    }

    return {
      remaining: Math.max(0, max - bucket.count),
      resetAt: bucket.resetAt
    };
  };
}

function createDeduper({ ttlMs = 15_000, maxEntries = 250 } = {}) {
  const seen = createTtlCache({ ttlMs, maxEntries });
  return {
    start(key) {
      if (seen.has(key)) return false;
      seen.set(key, true, ttlMs);
      return true;
    },
    finish(key) {
      seen.delete(key);
    }
  };
}

function createTaskQueue({ concurrency = 2, maxQueue = 4 } = {}) {
  let active = 0;
  const queue = [];

  function pump() {
    while (active < concurrency && queue.length) {
      const item = queue.shift();
      active += 1;
      Promise.resolve()
        .then(item.run)
        .then(item.resolve, item.reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    }
  }

  function schedule(taskName, run) {
    if (active >= concurrency && queue.length >= maxQueue) {
      const error = new Error("AI_QUEUE_FULL");
      error.status = 429;
      error.retryAfterSeconds = 10;
      error.taskName = taskName;
      throw error;
    }

    return new Promise((resolve, reject) => {
      queue.push({ run, resolve, reject, taskName });
      pump();
    });
  }

  return {
    schedule,
    snapshot() {
      return { active, queued: queue.length, concurrency, maxQueue };
    }
  };
}

function requestId() {
  return crypto.randomUUID();
}

module.exports = {
  clientIp,
  createDeduper,
  createRateLimiter,
  createTaskQueue,
  createTtlCache,
  requestId
};
