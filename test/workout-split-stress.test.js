"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { getCatalogExercise, getEnabledPublicExerciseIds } = require("../lib/workout-exercise-catalog");
const { validateWorkoutProgram } = require("../lib/workout-validator");
const { repairWorkoutProgram, repairWeeklyVolumeTargets } = require("../lib/workout-repair");
const { adjustWorkoutVolume } = require("../lib/workout-volume-adjustment");
const { buildLocalWorkoutProgram, buildLocalExerciseReplacement } = require("../lib/local-demo-generators");
const { classifySessionSplit } = require("../lib/workout-program-identity");
const { isExerciseCompatibleWithSplit, splitCompatibilityIssues } = require("../lib/workout-split-policy");

const IDS = getEnabledPublicExerciseIds();
const SPLITS = ["upper", "lower", "push", "pull", "legs", "full"];
const EQUIPMENT = [...new Set(IDS.map((id) => getCatalogExercise(id).equipment))];
const CONTEXT = { equipment: EQUIPMENT, experience: "professional", goalProfile: "hypertrophy", sessionDuration: 180, daysPerWeek: 1, requireSplitType: true };

// Independent test oracle: muscle accounting establishes body region, while
// reviewed movement fixtures cover cases where region/role differ from the
// largest credit. Never derive expectations from the policy under test.
function expectedRole(id) {
  if (id === "rack-pull") return "lower";
  if (id === "barbell-upright-row") return "pull";
  if (["muscle-up", "ring-muscle-up"].includes(id)) return "mixed-upper";
  const [muscle] = Object.entries(getCatalogExercise(id).setCredits).sort((a, b) => b[1] - a[1])[0];
  if (["quads", "hamstrings", "glutes", "calves"].includes(muscle)) return "lower";
  if (["chest", "delts", "triceps"].includes(muscle)) return "push";
  if (["back", "biceps", "rear_delts", "traps"].includes(muscle)) return "pull";
  assert.equal(muscle, "core", `unreviewed muscle for ${id}`);
  return "core";
}

function allowed(id, split) {
  const role = expectedRole(id);
  if (split === "full" || role === "core") return true;
  if (split === "upper") return ["push", "pull", "mixed-upper"].includes(role);
  if (split === "lower" || split === "legs") return role === "lower";
  return split === role;
}

function exercise(id, sets = 2) {
  const entry = getCatalogExercise(id);
  return { exerciseId: id, name: entry.title, demoName: entry.title, equipment: entry.equipment,
    muscleGroup: Object.keys(entry.setCredits)[0], sets, reps: "8-12", restSeconds: 90, rir: "1-3", notes: "" };
}

function session(split, ids) {
  return { name: split === "full" ? "Full Body" : split, splitType: split, exercises: ids.map((id) => exercise(id)) };
}

function assertPure(program, label) {
  for (const day of program.sessions) {
    assert.ok(SPLITS.includes(day.splitType), `${label}: missing splitType`);
    for (const item of day.exercises) assert.ok(allowed(item.exerciseId, day.splitType), `${label}: ${item.exerciseId} on ${day.splitType}`);
  }
  assert.deepEqual(splitCompatibilityIssues(program), [], label);
}

test("every enabled catalog exercise against every split, including spoofed AI muscle labels", (t) => {
  let rejected = 0;
  for (const id of IDS) {
    assert.equal(getCatalogExercise(id).splitRole, expectedRole(id), `catalog role for ${id}`);
    for (const split of SPLITS) {
      const expected = allowed(id, split);
      assert.equal(isExerciseCompatibleWithSplit(id, split), expected, `${id}/${split}`);
      const program = { sessions: [session(split, [id])] };
      // An AI label must never override canonical catalog metadata.
      program.sessions[0].exercises[0].muscleGroup = split === "lower" ? "quads" : "chest";
      const result = validateWorkoutProgram(program, CONTEXT);
      const violations = result.errors.filter((error) => /incompatible with this split/.test(error));
      assert.equal(violations.length, expected ? 0 : 1, `${id}/${split}: ${result.errors}`);
      if (!expected) { rejected++; assert.equal(result.ok, false); }
    }
  }
  t.diagnostic(`${IDS.length * SPLITS.length} exercise/split combinations; ${rejected} incompatible placements rejected`);
});

test("every incompatible catalog placement is repaired to the same split or rejected, never relabeled", (t) => {
  let cases = 0;
  for (const split of SPLITS.filter((value) => value !== "full")) {
    for (const id of IDS.filter((value) => !allowed(value, split))) {
      const program = { sessions: [session(split, [id])] };
      repairWorkoutProgram(program, { ...CONTEXT, applyVolumeTargets: false });
      assert.equal(program.sessions[0].splitType, split);
      assert.equal(program.sessions[0].name, split);
      assertPure(program, `repair ${id}/${split}`);
      cases++;
    }
  }
  t.diagnostic(`${cases} incompatible placements repaired through the complete repair pipeline`);
});

test("replacement candidate exhaustion and unknown exercises fail closed", () => {
  for (const split of SPLITS) assert.equal(isExerciseCompatibleWithSplit("invented-exercise", split), false);
  for (const split of SPLITS.filter((value) => value !== "full")) {
    const badId = IDS.find((id) => !allowed(id, split));
    const program = { sessions: [session(split, [badId])] };
    repairWorkoutProgram(program, { ...CONTEXT, equipment: ["unavailable-equipment"], applyVolumeTargets: false });
    assert.equal(validateWorkoutProgram(program, CONTEXT).ok, false, `exhaustion ${split}`);
    assert.equal(program.sessions[0].splitType, split);
  }
  assert.equal(validateWorkoutProgram({ sessions: {} }, CONTEXT).ok, false);
  assert.equal(validateWorkoutProgram({ sessions: [null] }, CONTEXT).ok, false);
  assert.equal(validateWorkoutProgram({ sessions: [{ splitType: "upper", exercises: [null] }] }, CONTEXT).ok, false);
  assert.equal(validateWorkoutProgram({ sessions: [{ name: "Upper", splitType: "upper", exercises: {} }] }, CONTEXT).ok, false);
});

test("local rerolls across all split-compatible exercises and four experience levels", (t) => {
  let attempts = 0;
  let replacements = 0;
  for (const experience of ["beginner", "intermediate", "advanced", "professional"]) {
    for (const split of SPLITS) {
      for (const id of IDS.filter((value) => allowed(value, split))) {
        const replacement = buildLocalExerciseReplacement({ currentExercise: exercise(id), equipment: EQUIPMENT, experience, sessionSplit: split });
        attempts++;
        if (!replacement) continue;
        assert.ok(allowed(replacement.exerciseId, split), `${experience}/${split}/${id} -> ${replacement.exerciseId}`);
        assert.notEqual(replacement.exerciseId, id);
        replacements++;
      }
    }
  }
  t.diagnostic(`${attempts} reroll attempts, ${replacements} compatible replacements; remaining cases safely returned no candidate`);
});

test("volume addition chooses the compatible day, not the shortest day", () => {
  const program = { sessions: [session("upper", ["barbell-bench-press"]), session("lower", ["barbell-squat", "leg-curl"])] };
  for (const day of program.sessions) for (const item of day.exercises) item.sets = 4;
  const before = JSON.stringify(program);
  const result = adjustWorkoutVolume({ program, muscle: "quads", delta: 1, profile: CONTEXT });
  assert.equal(result.changed, true);
  assert.equal(result.change.action, "added-exercise");
  assert.equal(result.change.sessionIndex, 1);
  assertPure(result.program, "quads volume");
  assert.equal(JSON.stringify(program), before, "source plan is unchanged");
  const impossible = adjustWorkoutVolume({ program: { sessions: [program.sessions[0]] }, muscle: "quads", delta: 1, profile: CONTEXT });
  assert.equal(impossible.changed, false, "must not add leg work if no Lower day exists");
  assert.equal(impossible.reason, "no-compatible-adjustment", "do not misreport candidate exhaustion as excessive volume");
});

test("weekly volume solver preserves Upper/Lower and PPL even when repairing missing muscles", () => {
  for (const days of [
    [session("upper", ["barbell-bench-press", "barbell-row"]), session("lower", ["barbell-squat", "leg-curl"])],
    [session("push", ["barbell-bench-press"]), session("pull", ["barbell-row"]), session("legs", ["barbell-squat"])]
  ]) {
    const program = { goal: "buildMuscle", sessions: days };
    const repairs = [];
    repairWeeklyVolumeTargets(program, { ...CONTEXT, daysPerWeek: days.length, applyVolumeTargets: true }, repairs);
    assertPure(program, "volume solver");
    assert.ok(repairs.length > 0, "exercise real repair work");
  }
});

test("repeated +/- volume mutations across both splits never introduce incompatible work", (t) => {
  let changed = 0;
  let attempts = 0;
  for (const days of [
    [session("upper", ["barbell-bench-press", "barbell-row"]), session("lower", ["barbell-squat", "leg-curl"])],
    [session("push", ["barbell-bench-press"]), session("pull", ["barbell-row"]), session("legs", ["barbell-squat"])],
  ]) {
    let program = { sessions: days };
    for (let round = 0; round < 5; round++) {
      for (const muscle of ["chest", "back", "delts", "rear_delts", "traps", "biceps", "triceps", "quads", "hamstrings", "glutes", "calves", "core"]) {
        for (const delta of [1, 1, -1]) {
          const result = adjustWorkoutVolume({ program, muscle, delta, profile: CONTEXT });
          attempts++;
          if (result.changed) { program = result.program; changed++; }
          assertPure(program, `volume ${round}/${muscle}/${delta}`);
        }
      }
    }
  }
  t.diagnostic(`${attempts} volume requests; ${changed} safe plan mutations`);
});

test("local generator declares truthful canonical splits across days, goals, levels and languages", (t) => {
  let cases = 0;
  for (const language of ["en", "he", "ar"]) {
    for (const daysPerWeek of [1, 2, 3, 4, 5, 6]) {
      for (const experience of ["beginner", "intermediate", "advanced", "professional"]) {
        for (const goal of ["buildMuscle", "fatLoss"]) {
          const program = buildLocalWorkoutProgram({ equipment: EQUIPMENT, daysPerWeek, experience, goal, language, sessionDuration: 180 });
          assertPure(program, `local ${language}/${daysPerWeek}/${experience}/${goal}`);
          for (const day of program.sessions) {
            assert.equal(classifySessionSplit({ exercises: day.exercises }), day.splitType);
          }
          cases++;
        }
      }
    }
  }
  t.diagnostic(`${cases} local generator profiles`);
});

test("movement-aware identity does not label hip hinges Pull or mixed skills pure Pull", () => {
  assert.equal(classifySessionSplit({ exercises: [exercise("rack-pull")] }), "lower");
  assert.equal(classifySessionSplit({ exercises: [exercise("barbell-upright-row")] }), "pull");
  assert.equal(classifySessionSplit({ exercises: [exercise("muscle-up")] }), "upper");
});
