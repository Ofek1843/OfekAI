const test = require("node:test");
const assert = require("node:assert/strict");

async function loadGuestTrial() {
  return import("../public/js/guest-trial.mjs");
}

test("guest form drafts preserve text, selections, and checkbox state", async () => {
  const { serializeForm } = await loadGuestTrial();
  const elements = [
    { name: "limitations", type: "textarea", value: "shoulder pain" },
    { name: "days", type: "checkbox", value: "mon", checked: true },
    { name: "days", type: "checkbox", value: "wed", checked: false },
    { name: "goal", type: "radio", value: "strength", checked: false },
    { name: "goal", type: "radio", value: "muscle", checked: true }
  ];
  const draft = serializeForm({ elements });
  assert.equal(draft[0].value, "shoulder pain");
  assert.deepEqual(draft.filter((field) => field.name === "days").map((field) => field.checked), [true, false]);
  assert.deepEqual(draft.filter((field) => field.name === "goal").map((field) => field.checked), [false, true]);
});

test("guest form drafts restore values and notify dependent controls", async () => {
  const { restoreForm } = await loadGuestTrial();
  const changed = [];
  const elements = [
    { name: "goal", type: "radio", value: "strength", checked: true, dispatchEvent: () => changed.push("strength") },
    { name: "goal", type: "radio", value: "muscle", checked: false, dispatchEvent: () => changed.push("muscle") },
    { name: "days", type: "checkbox", value: "mon", checked: false, dispatchEvent: () => changed.push("mon") },
    { name: "days", type: "checkbox", value: "wed", checked: true, dispatchEvent: () => changed.push("wed") },
    { name: "age", type: "number", value: "", dispatchEvent: () => changed.push("age") }
  ];
  assert.equal(restoreForm({ elements }, [
    { name: "goal", type: "radio", value: "strength", checked: false },
    { name: "goal", type: "radio", value: "muscle", checked: true },
    { name: "days", type: "checkbox", value: "mon", checked: true },
    { name: "days", type: "checkbox", value: "wed", checked: false },
    { name: "age", type: "number", value: "31" }
  ]), true);
  assert.equal(elements[0].checked, false);
  assert.equal(elements[1].checked, true);
  assert.equal(elements[2].checked, true);
  assert.equal(elements[3].checked, false);
  assert.equal(elements[4].value, "31");
  assert.deepEqual(changed, ["strength", "muscle", "mon", "wed", "age"]);
});

test("guest Google handoff retains the builder return path and draft", async () => {
  const { startGuestSignup } = await loadGuestTrial();
  const values = new Map();
  let destination = "";
  global.sessionStorage = { setItem: (key, value) => values.set(key, value) };
  global.window = { location: { assign: (url) => { destination = url; } } };
  try {
    startGuestSignup("workout", "/workout-builder.html?resumeGuest=workout", [{ name: "goal", value: "buildMuscle" }], "google");
    const url = new URL(destination, "https://fuelphysique.com");
    assert.equal(url.searchParams.get("provider"), "google");
    assert.equal(url.searchParams.get("next"), "/workout-builder.html?resumeGuest=workout");
    assert.equal(JSON.parse(values.get("fp-guest-trial-v1:workout")).payload[0].value, "buildMuscle");
  } finally {
    delete global.sessionStorage;
    delete global.window;
  }
});

test("guest signup handoff reports one provider choice without blocking navigation", async () => {
  const { startGuestSignup } = await loadGuestTrial();
  const choices = [];
  const destinations = [];
  global.sessionStorage = { setItem() {} };
  global.window = { location: { assign: url => destinations.push(url) } };
  try {
    startGuestSignup("nutrition", "/nutrition-builder.html?resumeGuest=nutrition", null, "google", method => choices.push(method));
    startGuestSignup("workout", "/workout-builder.html?resumeGuest=workout", null, "", () => { throw new Error("analytics unavailable"); });
    assert.deepEqual(choices, ["google"]);
    assert.equal(destinations.length, 2);
    assert.match(destinations[0], /provider=google/);
    assert.match(destinations[1], /next=/);
  } finally {
    delete global.sessionStorage;
    delete global.window;
  }
});
