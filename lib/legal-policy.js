"use strict";

// These versions are deliberately shared by the web client and protected API
// routes.  Changing one requires a reviewed policy update and a fresh user
// acceptance; it is not a substitute for legal advice or consent records.
const TERMS_VERSION = "2026-08-08";
const PRIVACY_VERSION = "2026-08-08";
const MINIMUM_ACCOUNT_AGE = 15;
const REAUTHENTICATION_MAX_AGE_SECONDS = 10 * 60;

function hasAcceptedCurrentTerms(profile = {}) {
  return profile.termsAccepted === true && profile.termsVersion === TERMS_VERSION;
}

function publicLegalPolicy() {
  return { termsVersion: TERMS_VERSION, privacyVersion: PRIVACY_VERSION, minimumAccountAge: MINIMUM_ACCOUNT_AGE };
}

module.exports = {
  MINIMUM_ACCOUNT_AGE,
  PRIVACY_VERSION,
  REAUTHENTICATION_MAX_AGE_SECONDS,
  TERMS_VERSION,
  hasAcceptedCurrentTerms,
  publicLegalPolicy
};
