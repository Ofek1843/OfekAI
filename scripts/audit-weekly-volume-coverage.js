"use strict";

// Release-gate audit: every enabled public exercise must have an
// authoritative EXERCISE_SETCREDITS entry (weeklyVolume.mappingCoveragePercent
// === 100 requires this to hold for the catalog itself, not just for
// whatever exercises a particular generated program happened to use).
// Also reports the required/secondary/optional muscle classification and
// per-muscle catalog coverage (how many enabled exercises, primary vs
// secondary, credit each muscle) for visibility -- this is what surfaces a
// muscle with dangerously thin coverage (e.g. rear delts/traps before the
// rowing-credit fix) before it ships as a "0 weekly sets" surprise.

const { EXERCISE_SETCREDITS } = require("../lib/workout-setcredits-map");
const { getEnabledPublicExerciseIds, getCatalogExercise } = require("../lib/workout-exercise-catalog");
const { BASE_RANGES, classifyMuscleRequirement } = require("../lib/workout-volume-targets");

function main() {
  const enabledIds = getEnabledPublicExerciseIds();
  const missingCredits = [];
  const emptyCredits = [];

  for (const id of enabledIds) {
    const credits = EXERCISE_SETCREDITS[id];
    if (!credits) {
      missingCredits.push(id);
      continue;
    }
    if (Object.keys(credits).length === 0) {
      emptyCredits.push(id);
    }
  }

  const mappingCoveragePercent = enabledIds.length
    ? Math.round(((enabledIds.length - missingCredits.length) / enabledIds.length) * 1000) / 10
    : 0;

  const perMuscleCoverage = {};
  for (const muscle of Object.keys(BASE_RANGES)) {
    let primaryCount = 0;
    let secondaryCount = 0;
    for (const id of enabledIds) {
      const credit = EXERCISE_SETCREDITS[id]?.[muscle];
      if (!credit) continue;
      if (credit === 1) primaryCount += 1;
      else secondaryCount += 1;
    }
    perMuscleCoverage[muscle] = {
      primaryCount,
      secondaryCount,
      totalCount: primaryCount + secondaryCount,
      // Representative classification under a default hypertrophy/Gym
      // profile with broad equipment access -- the per-request
      // classification also considers the user's actual equipment
      // selection (see server.js), this is just the catalog-level default.
      defaultClassification: classifyMuscleRequirement(muscle, {
        priority: "hypertrophy",
        equipment: ["dumbbell", "machine", "barbell", "cable", "bodyweight", "pullupbar", "rings"]
      })
    };
  }

  const report = {
    enabledExerciseCount: enabledIds.length,
    mappingCoveragePercent,
    missingCredits,
    emptyCredits,
    perMuscleCoverage
  };

  console.log(JSON.stringify(report, null, 2));

  const thinMuscles = Object.entries(perMuscleCoverage).filter(([, stats]) => stats.totalCount <= 3);
  if (thinMuscles.length) {
    console.warn(
      "\nWarning: the following muscles have 3 or fewer contributing exercises in the entire catalog " +
        "(a program that happens not to use one of them can land at or near 0 weekly sets):"
    );
    for (const [muscle, stats] of thinMuscles) {
      console.warn(`  - ${muscle}: ${stats.totalCount} exercises (${stats.primaryCount} primary, ${stats.secondaryCount} secondary), classification=${stats.defaultClassification}`);
    }
  }

  if (missingCredits.length > 0) {
    console.error(`\nAudit FAILED: ${missingCredits.length} enabled public exercise(s) have no EXERCISE_SETCREDITS entry:`);
    for (const id of missingCredits) {
      const catalog = getCatalogExercise(id);
      console.error(`  - ${id} (${catalog?.title || "unknown title"})`);
    }
    process.exitCode = 1;
    return;
  }

  if (emptyCredits.length > 0) {
    console.error(`\nAudit FAILED: ${emptyCredits.length} enabled public exercise(s) have an EMPTY setCredits object:`);
    for (const id of emptyCredits) console.error(`  - ${id}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nAudit passed: every enabled public exercise has a non-empty set-credit mapping (100% catalog coverage).");
}

main();
