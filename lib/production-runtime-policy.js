"use strict";

// Test authentication and emulator endpoints are useful locally, but must never
// become a deployment-time alternative to Firebase verification or live storage.
function assertProductionRuntime(env = process.env) {
  const production = String(env.NODE_ENV || "").trim().toLowerCase() === "production"
    || String(env.RENDER || "").trim().toLowerCase() === "true";
  if (!production) return;

  const unsafe = [];
  if (String(env.MOCK_EXTERNAL_SERVICES || "").toLowerCase() === "true") unsafe.push("MOCK_EXTERNAL_SERVICES");
  if (env.FUELPHYSIQUE_LOCAL_DEMO === "1") unsafe.push("FUELPHYSIQUE_LOCAL_DEMO");
  for (const name of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST", "STORAGE_EMULATOR_HOST"]) {
    if (env[name] !== undefined && String(env[name]) !== "") unsafe.push(name);
  }
  if (unsafe.length) {
    // Name the setting, never its value: environment values may be sensitive.
    throw new Error(`Unsafe production configuration: disable ${unsafe.join(", ")} before starting FuelPhysique.`);
  }
}

module.exports = { assertProductionRuntime };
