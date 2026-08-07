"use strict";

const { calculateWeeklyVolume } = require("./workout-volume");
const { EXERCISE_SETCREDITS } = require("./workout-setcredits-map");
const {
  MUSCLE_POLICY,
  allVolumePolicies,
  classifyMuscleRequirement,
  detailedVolumeStatus,
  calculateProgramQualityScore
} = require("./workout-volume-targets");
const { primaryMuscleForExerciseId } = require("./workout-focus");

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function targetPointForPolicy(policy) {
  if (!policy) return 0;
  return (finite(policy.preferredMin) + finite(policy.preferredMax)) / 2;
}

function buildSourceIndex(program, setCreditsMap = EXERCISE_SETCREDITS) {
  const sources = Object.fromEntries(Object.keys(MUSCLE_POLICY).map((muscle) => [muscle, []]));
  for (let sessionIndex = 0; sessionIndex < (program?.sessions || []).length; sessionIndex += 1) {
    const session = program.sessions[sessionIndex];
    for (let exerciseIndex = 0; exerciseIndex < (session?.exercises || []).length; exerciseIndex += 1) {
      const exercise = session.exercises[exerciseIndex];
      const exerciseId = String(exercise?.exerciseId || "");
      const credits = setCreditsMap[exerciseId] || {};
      const sets = finite(exercise?.sets);
      const authoritativePrimaryMuscle = primaryMuscleForExerciseId(exerciseId);
      for (const [muscle, rawCredit] of Object.entries(credits)) {
        if (!sources[muscle]) sources[muscle] = [];
        const credit = finite(rawCredit);
        const direct = credit === 1 ? sets : 0;
        const fractional = credit > 0 && credit < 1 ? sets * credit : 0;
        sources[muscle].push({
          sessionIndex,
          exerciseIndex,
          exerciseId,
          name: String(exercise?.name || exerciseId),
          sets,
          credit,
          direct,
          fractional,
          effective: direct + fractional,
          primaryMuscle: authoritativePrimaryMuscle,
          contributionType: credit === 1 ? "direct" : "fractional"
        });
      }
    }
  }
  return sources;
}

function buildVolumeLedger(program, profile = {}, setCreditsMap = EXERCISE_SETCREDITS) {
  const volume = calculateWeeklyVolume(program, setCreditsMap);
  const policies = allVolumePolicies(profile);
  const sourceIndex = buildSourceIndex(program, setCreditsMap);
  const muscles = {};

  for (const muscle of Object.keys(MUSCLE_POLICY)) {
    const policy = policies[muscle];
    const actual = volume.perMuscle[muscle] || {};
    const directSets = finite(actual.direct);
    const fractionalIndirectSets = finite(actual.fractional);
    const effectiveTotal = finite(actual.total);
    const targetPoint = targetPointForPolicy(policy);
    muscles[muscle] = {
      muscle,
      requirement: classifyMuscleRequirement(muscle, profile),
      hardMinimum: finite(policy?.minimumEffective),
      preferredMinimum: finite(policy?.preferredMin),
      preferredMaximum: finite(policy?.preferredMax),
      hardMaximum: finite(policy?.hardMaximum),
      targetPoint,
      directSets,
      fractionalIndirectSets,
      effectiveTotal,
      remainingDeficit: Math.max(0, targetPoint - effectiveTotal),
      deficitToHardMinimum: Math.max(0, finite(policy?.minimumEffective) - effectiveTotal),
      amountAbovePreferred: Math.max(0, effectiveTotal - finite(policy?.preferredMax)),
      amountAboveHardMaximum: Math.max(0, effectiveTotal - finite(policy?.hardMaximum)),
      frequency: finite(actual.frequency),
      status: detailedVolumeStatus(effectiveTotal, policy),
      sourceExercises: sourceIndex[muscle] || []
    };
  }

  return {
    muscles,
    totalHardSets: finite(volume.totalHardSets),
    mappedExercises: finite(volume.mappedExercises),
    unknownExercises: finite(volume.unknownExercises),
    mappingCoveragePercent: finite(volume.mappingCoveragePercent),
    warnings: volume.warnings || []
  };
}

function buildQualityDiagnostic(program, profile = {}, setCreditsMap = EXERCISE_SETCREDITS) {
  const ledger = buildVolumeLedger(program, profile, setCreditsMap);
  const perMuscle = Object.fromEntries(
    Object.entries(ledger.muscles).map(([muscle, entry]) => [muscle, {
      direct: entry.directSets,
      fractional: entry.fractionalIndirectSets,
      total: entry.effectiveTotal,
      frequency: entry.frequency
    }])
  );
  const quality = calculateProgramQualityScore(perMuscle, profile);
  return {
    score: quality.score,
    perMuscle: Object.fromEntries(Object.entries(quality.perMuscle).map(([muscle, score]) => [muscle, {
      score,
      ...ledger.muscles[muscle]
    }])),
    mappingCoveragePercent: ledger.mappingCoveragePercent,
    unknownExercises: ledger.unknownExercises
  };
}

function buildProgrammingConstraintSummary(profile = {}) {
  const policies = allVolumePolicies(profile);
  return {
    goal: profile.priority || "hypertrophy",
    experience: profile.experience || "intermediate",
    daysPerWeek: finite(profile.daysPerWeek),
    sessionDuration: finite(profile.sessionDuration),
    selectedEquipment: Array.isArray(profile.equipment) ? profile.equipment : [],
    muscleFocusMode: profile.muscleFocusMode || "balanced",
    selectedMuscles: Array.isArray(profile.selectedMuscles) ? profile.selectedMuscles : [],
    muscles: Object.fromEntries(Object.entries(policies)
      .filter(([muscle]) => classifyMuscleRequirement(muscle, profile) === "required")
      .map(([muscle, policy]) => [muscle, {
        hard: [policy.minimumEffective, policy.hardMaximum],
        preferred: [policy.preferredMin, policy.preferredMax],
        targetPoint: targetPointForPolicy(policy)
      }]))
  };
}

function formatLedgerForAiRepair(ledger) {
  return Object.fromEntries(Object.entries(ledger?.muscles || {})
    .filter(([, entry]) => entry.requirement === "required" || entry.deficitToHardMinimum > 0 || entry.amountAboveHardMaximum > 0)
    .map(([muscle, entry]) => [muscle, {
      direct: entry.directSets,
      indirect: entry.fractionalIndirectSets,
      effective: entry.effectiveTotal,
      preferred: [entry.preferredMinimum, entry.preferredMaximum],
      hard: [entry.hardMinimum, entry.hardMaximum],
      targetPoint: entry.targetPoint,
      deficit: entry.remainingDeficit,
      preferredExcess: entry.amountAbovePreferred,
      hardExcess: entry.amountAboveHardMaximum,
      contributingDirectIsolation: entry.sourceExercises
        .filter((source) => source.contributionType === "direct" && source.primaryMuscle === muscle)
        .map((source) => ({ exerciseId: source.exerciseId, name: source.name, sets: source.sets })),
      contributingCompounds: entry.sourceExercises
        .filter((source) => source.contributionType === "fractional")
        .map((source) => ({ exerciseId: source.exerciseId, name: source.name, sets: source.sets, credit: source.credit }))
    }])
  );
}

module.exports = {
  targetPointForPolicy,
  buildVolumeLedger,
  buildQualityDiagnostic,
  buildProgrammingConstraintSummary,
  formatLedgerForAiRepair
};
