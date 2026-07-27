// Calculate weekly volume distribution across muscle groups.
//
// Returns {
//   perMuscle: { muscle: { direct, fractional, total }, ... },
//   totalHardSets,
//   mappedExercises,          // count of exercises found in setCreditsMap
//   unknownExercises,         // count of exercises NOT found in setCreditsMap
//   mappingCoveragePercent,   // mappedExercises / totalExercises * 100 (0 if no exercises)
//   warnings
// }
//
// Unknown exercises produce warnings, not invented credits — if an exercise
// isn't in setCreditsMap it contributes 0 to perMuscle, never a guess.

const LOW_COVERAGE_THRESHOLD_PERCENT = 60;

// Deterministic alias normalization: the AI-generated program may return an
// exerciseId with different casing/spacing/punctuation than the setCredits
// map's keys ("Barbell Bench Press" vs "barbell-bench-press"). This slugifies
// the id the same way every time so a mapping isn't missed purely due to
// formatting — it does NOT invent a new mapping, it only improves lookup of
// an EXISTING one.
function slugifyExerciseId(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function calculateWeeklyVolume(program, setCreditsMap = {}) {
  const perMuscle = {};
  const warnings = [];
  let totalHardSets = 0;
  let mappedExercises = 0;
  let unknownExercises = 0;
  let totalExercises = 0;

  if (!Array.isArray(program?.sessions)) {
    return {
      perMuscle,
      totalHardSets,
      mappedExercises,
      unknownExercises,
      mappingCoveragePercent: 0,
      warnings: ["No sessions in program"]
    };
  }

  for (const session of program.sessions) {
    if (!Array.isArray(session?.exercises)) continue;

    for (const exercise of session.exercises) {
      totalExercises += 1;
      const sets = Number(exercise.sets) || 0;
      const rawId = exercise.exerciseId || "";
      const slug = slugifyExerciseId(rawId);

      totalHardSets += sets;

      // Look up by the raw id first (already-canonical ids stay exact),
      // then by the slugified form (catches formatting differences only).
      const credits = setCreditsMap[rawId] || setCreditsMap[slug];

      if (!credits) {
        unknownExercises += 1;
        warnings.push(`Exercise "${rawId || "(missing exerciseId)"}" has no known muscle credit mapping.`);
        continue;
      }

      mappedExercises += 1;

      for (const [muscle, credit] of Object.entries(credits)) {
        const lowerMuscle = muscle.toLowerCase();
        if (!perMuscle[lowerMuscle]) {
          perMuscle[lowerMuscle] = { direct: 0, fractional: 0, total: 0 };
        }

        const hardSets = sets * credit;
        if (credit === 1.0) {
          perMuscle[lowerMuscle].direct += hardSets;
        } else {
          perMuscle[lowerMuscle].fractional += hardSets;
        }
        perMuscle[lowerMuscle].total += hardSets;
      }
    }
  }

  const mappingCoveragePercent = totalExercises > 0
    ? Math.round((mappedExercises / totalExercises) * 1000) / 10
    : 0;

  // Don't let a mostly-unmapped program's volume numbers be mistaken for a
  // reliable total — flag it explicitly rather than silently returning
  // small/incomplete perMuscle totals with no signal that most exercises
  // were skipped.
  if (totalExercises > 0 && mappingCoveragePercent < LOW_COVERAGE_THRESHOLD_PERCENT) {
    warnings.push(
      `Weekly volume mapping coverage is only ${mappingCoveragePercent}% (${mappedExercises}/${totalExercises} exercises); totals below are incomplete and should not be treated as the full weekly volume.`
    );
  }

  return { perMuscle, totalHardSets, mappedExercises, unknownExercises, mappingCoveragePercent, warnings };
}

module.exports = { calculateWeeklyVolume, slugifyExerciseId };
