// Safe (never-leak-the-key) diagnostics for the OpenAI integration, plus
// the shared upstream-vs-internal error distinction used to decide when a
// failure should be surfaced to the client as our own status code (400,
// 401, 409, 422, 429 — application-generated) versus as a generic 502
// (the upstream AI provider failed, which is not the client's fault and
// not something they can act on by retrying with different input).

const KEY_PREVIEW_CHARS = 4;

// Returns metadata safe to log/expose: presence, length, and a few boundary
// characters — never enough to reconstruct or brute-force the key, but
// enough to tell "no key set" apart from "wrong key" apart from
// "structurally implausible value (whitespace/quotes included)".
function getOpenAiKeyDiagnostics(env = process.env) {
  const raw = env.OPENAI_API_KEY || "";
  const trimmed = raw.trim();

  return {
    present: trimmed.length > 0,
    trimmedLength: trimmed.length,
    first4: trimmed.slice(0, KEY_PREVIEW_CHARS),
    last4: trimmed.slice(-KEY_PREVIEW_CHARS),
    // A raw key containing surrounding whitespace or wrapping quotes (a
    // common copy-paste mistake into Render's env var UI) is a structural
    // red flag even before any network call is made.
    hasSurroundingWhitespaceOrQuotes: raw !== trimmed || /^['"].*['"]$/.test(trimmed),
    looksStructurallyPlausible: /^sk-[A-Za-z0-9_-]{20,}$/.test(trimmed)
  };
}

function logOpenAiStartupDiagnostics(env = process.env, log = console.log) {
  const diagnostics = getOpenAiKeyDiagnostics(env);
  log(
    "[openai-diagnostics] startup:",
    JSON.stringify({
      apiKeyPresent: diagnostics.present,
      apiKeyTrimmedLength: diagnostics.trimmedLength,
      apiKeyFirst4: diagnostics.first4,
      apiKeyLast4: diagnostics.last4,
      apiKeyLooksStructurallyPlausible: diagnostics.looksStructurallyPlausible,
      apiKeyHasSurroundingWhitespaceOrQuotes: diagnostics.hasSurroundingWhitespaceOrQuotes,
      selectedModel: env.OPENAI_CHAT_MODEL || "gpt-4o-mini",
      nodeEnv: env.NODE_ENV || "development"
    })
  );
  return diagnostics;
}

// Marks an Error as originating from the OpenAI upstream call (as opposed
// to our own validation/auth/rate-limit logic, which also throws Errors
// with a .status). Route handlers use this to decide 502-with-localized-
// message vs. passing through error.status unchanged.
function markAsUpstreamProviderError(error, { status, requestId, type, code, sanitizedMessage } = {}) {
  error.isUpstreamProviderError = true;
  error.upstreamStatus = status;
  error.upstreamRequestId = requestId || null;
  error.upstreamType = type || null;
  error.upstreamCode = code || null;
  error.upstreamSanitizedMessage = sanitizedMessage || null;
  return error;
}

function isUpstreamProviderError(error) {
  return Boolean(error && error.isUpstreamProviderError);
}

const PROVIDER_UNAVAILABLE_MESSAGES = {
  en: "Workout generation service is temporarily unavailable.",
  he: "שירות יצירת תוכנית האימונים אינו זמין כרגע."
};

function providerUnavailableMessage(language) {
  return language === "he" ? PROVIDER_UNAVAILABLE_MESSAGES.he : PROVIDER_UNAVAILABLE_MESSAGES.en;
}

// Sanitizes an upstream OpenAI error body for server-side logging — strips
// anything that could contain the request payload (which may include user
// input) beyond the small, structured error object OpenAI returns, and
// never includes the Authorization header/key.
function sanitizeUpstreamErrorForLogging(status, requestId, body) {
  return {
    status,
    requestId: requestId || null,
    type: body?.error?.type || null,
    code: body?.error?.code || null,
    message: body?.error?.message || null
  };
}

module.exports = {
  getOpenAiKeyDiagnostics,
  logOpenAiStartupDiagnostics,
  markAsUpstreamProviderError,
  isUpstreamProviderError,
  providerUnavailableMessage,
  sanitizeUpstreamErrorForLogging,
  PROVIDER_UNAVAILABLE_MESSAGES
};
