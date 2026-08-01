// Environment-aware Firebase Authentication authDomain resolution.
//
// Root cause of the reported issue: Firebase's OAuth consent screen shows
// "Continue to {authDomain}" verbatim — and this project's authDomain was
// hardcoded to the internal Firebase project identifier
// (ofek-ai-55f1d.firebaseapp.com), so every Google sign-in showed that
// instead of the public FuelPhysique domain. Renaming the public-facing
// project name, support email or email sender domain (see
// email-verification-core.mjs) does NOT touch this value — authDomain is a
// separate, dedicated Firebase Auth setting.
//
// Pure, DOM-free logic so it is unit-testable outside a browser (same .mjs
// pattern as auth-google-core.mjs / email-verification-core.mjs). The only
// consumer is firebase-config.js, which passes window.location.hostname in.

// The Firebase project's own auth domain. Always valid, always authorized,
// and is what a Google consent screen shows if nothing else is configured.
// Used for every hostname that isn't explicitly production -- see the
// module doc comment for why: a broken local/preview OAuth flow is a dev
// inconvenience, but a proxy that could accidentally route a local dev
// session's credentials into a production-looking domain is a much worse
// failure mode.
export const FIREBASE_PROJECT_AUTH_DOMAIN = "ofek-ai-55f1d.firebaseapp.com";

// Production shows the real FuelPhysique domain on the Google consent
// screen. This requires the reverse proxy at /__/auth/* (see server.js)
// forwarding to FIREBASE_PROJECT_AUTH_DOMAIN, and this exact domain added
// to Firebase's Authorized domains and to the OAuth client's Authorized
// redirect URIs as https://fuelphysique.com/__/auth/handler — see the
// Console handoff steps in the release report.
export const PRODUCTION_AUTH_DOMAIN = "fuelphysique.com";

// Hostnames that resolve to the production authDomain. www is included
// because it is a legitimate way visitors may reach the site even though
// the canonical domain is the bare apex.
export const PRODUCTION_HOSTNAMES = Object.freeze(["fuelphysique.com", "www.fuelphysique.com"]);

// resolveAuthDomain(hostname) -> the authDomain Firebase should be
// initialized with for this environment. Anything that is not an exact,
// case-insensitive match for a production hostname (localhost, 127.0.0.1,
// a Render preview URL, a typo'd host header, an attacker-controlled Host
// header on a misconfigured proxy) deliberately falls back to the Firebase
// project domain rather than ever being trusted as "must be production".
export function resolveAuthDomain(hostname) {
  const normalized = String(hostname || "").trim().toLowerCase();
  return PRODUCTION_HOSTNAMES.includes(normalized) ? PRODUCTION_AUTH_DOMAIN : FIREBASE_PROJECT_AUTH_DOMAIN;
}

// True when resolveAuthDomain(hostname) selected the production domain --
// exposed separately so callers (and tests) can assert the environment
// classification itself, not just its side effect on authDomain.
export function isProductionAuthHostname(hostname) {
  return resolveAuthDomain(hostname) === PRODUCTION_AUTH_DOMAIN;
}
