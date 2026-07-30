// Live USD->ILS rate for displaying converted pricing to Hebrew users.
// Frankfurter (https://frankfurter.dev) is a free, keyless FX API backed by
// the European Central Bank's daily reference rates — no signup, no quota
// to run out of. Cached in-memory so we hit it at most once per interval
// regardless of traffic, with a conservative fallback if it's ever
// unreachable so pricing never breaks.

const FX_URL = "https://api.frankfurter.dev/v1/latest?from=USD&to=ILS";
const CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours
const FALLBACK_RATE = 3.7;

let cached = null; // { rate, source, updatedAt }
let cachedAt = 0;

async function fetchLiveRate() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(FX_URL, { signal: controller.signal });
    if (!response.ok) throw new Error(`FX request failed with status ${response.status}`);
    const data = await response.json();
    const rate = Number(data?.rates?.ILS);
    if (!Number.isFinite(rate) || rate <= 0) throw new Error("FX response missing a usable ILS rate");
    return rate;
  } finally {
    clearTimeout(timeout);
  }
}

async function getUsdToIlsRate() {
  const now = Date.now();
  if (cached && now - cachedAt < CACHE_MS) return cached;

  try {
    const rate = await fetchLiveRate();
    cached = { rate, source: "live", updatedAt: new Date(now).toISOString() };
  } catch (error) {
    console.warn("FX rate fetch failed, using fallback:", error.message);
    // Keep serving the last known live rate if we have one; only fall back
    // to the hard-coded estimate when we have never fetched successfully.
    cached = cached
      ? { ...cached, source: "stale" }
      : { rate: FALLBACK_RATE, source: "fallback", updatedAt: new Date(now).toISOString() };
  }
  cachedAt = now;
  return cached;
}

module.exports = { getUsdToIlsRate, FALLBACK_RATE };
