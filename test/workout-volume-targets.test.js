// Unit tests for lib/workout-volume-targets.js — the deterministic,
// non-AI weekly hard-set target ranges shown next to each muscle's actual
// credited volume in the Weekly Muscle Volume summary.

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  BASE_RANGES,
  targetRangeForMuscle,
  allTargetRanges,
  volumeStatus
} = require("../lib/workout-volume-targets");

test("targetRangeForMuscle: returns null for an unrecognized muscle", () => {
  assert.equal(targetRangeForMuscle("not-a-real-muscle"), null);
});

test("targetRangeForMuscle: every canonical BASE_RANGES muscle returns a valid {min,max} for a default profile", () => {
  for (const muscle of Object.keys(BASE_RANGES)) {
    const range = targetRangeForMuscle(muscle, {});
    assert.ok(range, `expected a range for ${muscle}`);
    assert.ok(Number.isInteger(range.min) && range.min >= 2, `${muscle} min must be a sane positive integer`);
    assert.ok(Number.isInteger(range.max) && range.max >= range.min, `${muscle} max must be >= min`);
  }
});

test("targetRangeForMuscle: is case-insensitive on the muscle key", () => {
  const lower = targetRangeForMuscle("chest", {});
  const upper = targetRangeForMuscle("CHEST", {});
  assert.deepEqual(lower, upper);
});

test("targetRangeForMuscle: advanced experience raises the ceiling but not the floor, vs beginner", () => {
  const beginner = targetRangeForMuscle("chest", { experience: "beginner", priority: "hypertrophy", daysPerWeek: 4 });
  const advanced = targetRangeForMuscle("chest", { experience: "advanced", priority: "hypertrophy", daysPerWeek: 4 });
  assert.ok(advanced.max > beginner.max, "advanced ceiling must exceed beginner ceiling");
  assert.ok(advanced.min >= beginner.min, "advanced floor must never be lower than beginner's");
});

test("targetRangeForMuscle: strength profile scales the range down from hypertrophy for the same muscle/experience/days", () => {
  const hypertrophy = targetRangeForMuscle("back", { experience: "intermediate", priority: "hypertrophy", daysPerWeek: 4 });
  const strength = targetRangeForMuscle("back", { experience: "intermediate", priority: "strength", daysPerWeek: 4 });
  assert.ok(strength.max < hypertrophy.max, "strength favors intensity over volume, so its range must be lower");
  assert.ok(strength.min < hypertrophy.min);
});

test("targetRangeForMuscle: low training frequency caps the ceiling", () => {
  const twoDays = targetRangeForMuscle("quads", { experience: "advanced", priority: "hypertrophy", daysPerWeek: 2 });
  const fiveDays = targetRangeForMuscle("quads", { experience: "advanced", priority: "hypertrophy", daysPerWeek: 5 });
  assert.ok(twoDays.max < fiveDays.max, "2 days/week must not be able to reach the same ceiling as 5 days/week");
});

test("targetRangeForMuscle: min never exceeds max even under heavily compressed multipliers", () => {
  const worstCase = targetRangeForMuscle("core", { experience: "beginner", priority: "skills", daysPerWeek: 2 });
  assert.ok(worstCase.min <= worstCase.max, `min (${worstCase.min}) must not exceed max (${worstCase.max})`);
});

test("targetRangeForMuscle: an unrecognized experience/priority falls back to the intermediate/hypertrophy default, not a crash", () => {
  const fallback = targetRangeForMuscle("chest", { experience: "not-a-real-level", priority: "not-a-real-priority", daysPerWeek: 4 });
  const explicit = targetRangeForMuscle("chest", { experience: "intermediate", priority: "hypertrophy", daysPerWeek: 4 });
  assert.deepEqual(fallback, explicit);
});

test("allTargetRanges: returns a range for every BASE_RANGES muscle in one call", () => {
  const ranges = allTargetRanges({ experience: "advanced", priority: "hypertrophy", daysPerWeek: 4 });
  assert.deepEqual(Object.keys(ranges).sort(), Object.keys(BASE_RANGES).sort());
});

test("volumeStatus: below/in-range/above boundaries are inclusive on both ends", () => {
  const range = { min: 10, max: 20 };
  assert.equal(volumeStatus(9, range), "below");
  assert.equal(volumeStatus(10, range), "in-range");
  assert.equal(volumeStatus(15, range), "in-range");
  assert.equal(volumeStatus(20, range), "in-range");
  assert.equal(volumeStatus(21, range), "above");
});

test("volumeStatus: a null range (unrecognized muscle) reports 'unknown', never a false in-range claim", () => {
  assert.equal(volumeStatus(15, null), "unknown");
});

test("no target range logic depends on any AI-generated field — profile is entirely deterministic inputs", () => {
  const source = require("fs").readFileSync(
    require("path").join(__dirname, "..", "lib", "workout-volume-targets.js"),
    "utf8"
  );
  assert.doesNotMatch(source, /openai|gpt|createChatCompletion/i, "must never reference the AI layer");
});
