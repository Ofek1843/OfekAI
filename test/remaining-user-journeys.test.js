"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const html = (name) => read(`public/${name}.html`);
const js = (name) => read(`public/js/${name}.js`);
const css = (name) => read(`public/css/${name}.css`);

function includes(source, fragment, label) {
  assert.ok(source.includes(fragment), `${label || "source"} should include ${fragment}`);
}

test("remaining journeys expose complete protected route shells", () => {
  const routes = [
    ["dashboard", "dashboard", "dashboardStatus"],
    ["social", "social", "globalStatus"],
    ["workout-builder", "workout-builder", "wizardError"],
    ["workout-tracker", "workout-tracker", "trackerStatus"],
    ["nutrition-builder", "nutrition-builder", "builder-status"],
    ["manual-nutrition-builder", "manual-nutrition-builder", "saveStatus"],
    ["my-workout-plans", "my-workout-plans", "plansStatus"],
    ["my-nutrition-plans", "my-nutrition-plans", "plansStatus"],
    ["progress", "progress", "progressStatus"],
    ["app", "app-auth", "settingsTitle"]
  ];

  for (const [route, script, statusId] of routes) {
    const page = html(route);
    assert.match(page, /<title>[^<]+<\/title>/, `${route} has a document title`);
    assert.match(page, new RegExp(`id=["']${statusId}["']`), `${route} has its status shell`);
    includes(js(script), "guardProtectedPage", `${route} auth guard`);
  }

  const authPage = html("auth");
  includes(authPage, 'id="authForm"', "auth login/signup form");
  includes(authPage, 'id="loginTab"', "auth login control");
  includes(authPage, 'id="signupTab"', "auth signup control");
  includes(authPage, 'aria-live="polite"', "auth status regions");
});

test("Hebrew RTL behavior is deterministic across the main journeys", () => {
  const localizedScripts = [
    "dashboard",
    "social",
    "workout-builder",
    "workout-tracker",
    "nutrition-builder",
    "manual-nutrition-builder",
    "my-workout-plans",
    "my-nutrition-plans",
    "progress"
  ];

  for (const name of localizedScripts) {
    const source = js(name);
    assert.match(source, /language|isHebrew|const he\s*=|let language/, `${name} has a language selection path`);
    assert.match(source, /document\.documentElement\.dir\s*=|document\.documentElement\.setAttribute\(["']dir["']/, `${name} sets document direction`);
    assert.match(source, /document\.documentElement\.lang\s*=|document\.documentElement\.setAttribute\(["']lang["']/, `${name} sets document language`);
  }

  includes(js("auth"), "ofek-ai-language", "auth language persistence");
  includes(html("app"), 'id="languageTab"', "settings language control");
  includes(js("verification-gate"), "overlay.setAttribute(\"dir\", \"rtl\")", "verification gate RTL");
  assert.match(read("public/js/social-core.mjs"), /[\u0590-\u05FF]/, "social strings include Hebrew localization");
});

test("keyboard and accessibility contracts cover navigation, forms, dialogs and status", () => {
  const dashboard = html("dashboard");
  includes(dashboard, 'id="mobileMenuButton"', "dashboard menu button");
  includes(dashboard, 'aria-controls="mobileDrawerPanel"', "dashboard drawer relationship");
  includes(dashboard, 'aria-expanded="false"', "dashboard drawer state");
  includes(dashboard, 'data-dashboard-search', "dashboard search");
  includes(dashboard, 'role="status"', "dashboard live status");
  includes(js("dashboard"), "event.key === \"Escape\"", "dashboard Escape handling");

  const social = html("social");
  for (const id of ["userSearchInput", "messageInput", "shareConversationSelect", "shareSourceSelect"]) {
    assert.match(social, new RegExp(`for=["']${id}["']`), `${id} has a label`);
  }
  for (const id of ["friendsTab", "messagesTab", "searchButton", "shareMenuButton", "sendButton", "copyArtifactButton"]) {
    assert.match(social, new RegExp(`<button(?=[^>]*id=["']${id}["'])(?=[^>]*type=["'](?:button|submit)["'])[^>]*>`), `${id} is a typed control`);
  }
  includes(social, 'role="status" aria-live="polite"', "social status announcements");
  includes(social, 'role="alert"', "social validation errors");

  const manual = html("manual-nutrition-builder");
  includes(manual, 'id="loadMoreMeals" type="button"', "manual nutrition load more");
  includes(manual, 'id="mobileMenuToggle" class="mobile-menu-toggle" type="button"', "manual nutrition mobile menu");
  includes(manual, 'aria-controls="dailyMenuPanel"', "manual nutrition drawer relationship");
  includes(manual, 'id="savePlan"', "manual nutrition save control");
  includes(manual, 'id="saveStatus" class="manual-status" role="status"', "manual nutrition save status");

  const auth = html("auth");
  assert.match(auth, /<label[^>]+for=["'](?:email|password|linkEmail|linkPassword)["']/g, "auth fields are labelled");
  includes(auth, 'id="authMessage"', "auth login/signup message");

  for (const sheet of ["dashboard", "social", "manual-nutrition-builder", "workout-builder", "workout-tracker", "nutrition-builder"]) {
    assert.match(css(sheet), /:focus(?:-visible)?/, `${sheet} exposes keyboard focus styling`);
    assert.match(css(sheet), /@media/, `${sheet} exposes responsive rules`);
  }
  includes(js("nutrition-builder"), "event.key === \"Escape\"", "nutrition shopping-list Escape handling");
});

test("Workout Builder, saved plans and Tracker preserve the user journey", () => {
  const builder = js("workout-builder");
  includes(builder, "validateWizardStep", "workout validation");
  includes(builder, "required", "workout required fields");
  includes(builder, "wizardNextButton", "workout next control");
  includes(builder, "wizardBackButton", "workout back control");
  includes(builder, "saveWorkoutButton.disabled = true", "workout save duplicate protection");
  includes(builder, "Workout Saved", "workout save success state");

  const plans = js("my-workout-plans");
  includes(plans, "saveEditedPlan", "saved workout editing");
  includes(plans, "share=workout", "saved workout social sharing");
  includes(plans, "activeWorkoutPlanId", "saved workout activation");
  includes(plans, "batch.delete", "saved workout deletion");

  const tracker = js("workout-tracker");
  for (const fragment of ["activePlanId", "restoreDraft", "startRestTimer", "finishWorkout", "localStorage", "completedAt", "completedSets"]) {
    includes(tracker, fragment, `tracker ${fragment}`);
  }
  includes(tracker, "successSummary", "tracker completion status");
  includes(tracker, "finishWorkoutButton", "tracker finish control");
});

test("Nutrition saved plans and Manual Nutrition advanced interactions preserve state", () => {
  const manual = js("manual-nutrition-builder");
  for (const fragment of ["currentTotals", "renderRunningTotals", "data-portion", "data-up", "data-down", "data-remove", "savePlan", "loadExisting", "loadMoreMeals"]) {
    includes(manual, fragment, `manual nutrition ${fragment}`);
  }
  includes(manual, "params.get(\"edit\")", "manual nutrition edit flow");
  includes(manual, "params.get(\"duplicate\")", "manual nutrition duplicate flow");
  includes(manual, "share=nutrition", "manual nutrition social sharing");
  includes(manual, "toggleMenu", "manual nutrition mobile summary");

  const nutrition = js("nutrition-builder");
  for (const fragment of ["saveButton.disabled = true", "dailyCalories", "proteinGrams", "carbsGrams", "fatGrams", "copyShoppingListButton", "share-nutrition-button"]) {
    includes(nutrition, fragment, `nutrition ${fragment}`);
  }
  includes(nutrition, "shoppingListModal", "nutrition shopping list modal");

  const saved = js("my-nutrition-plans");
  includes(saved, "guardProtectedPage", "saved nutrition auth guard");
  includes(saved, "edit=", "saved nutrition edit flow");
  includes(saved, "duplicate=", "saved nutrition duplicate flow");
  includes(saved, "share=nutrition", "saved nutrition social sharing");
});

test("settings, session, dashboard search and Progress expose deterministic boundaries", () => {
  const app = js("app-auth");
  includes(app, "guardProtectedPage", "settings auth guard");
  includes(app, "signOut(auth)", "settings logout");
  includes(html("app"), 'id="languageTab"', "settings language control");

  const auth = js("auth");
  includes(auth, "ofek-ai-language", "auth language session");
  includes(auth, "signOut(auth)", "auth logout");
  includes(js("verification-gate"), "signOut(auth)", "verification logout");

  const dashboard = js("dashboard");
  for (const fragment of ["searchableItems", "searchDashboardItems", "Escape", "social.html", "nutrition-builder.html", "progress.html"]) {
    includes(dashboard, fragment, `dashboard ${fragment}`);
  }

  const progress = js("progress");
  for (const fragment of ["weightEntries", "bodyMeasurements", "progressPhotos", "renderChart", "directImageKitUpload", "shareProgressLink"]) {
    includes(progress, fragment, `progress ${fragment}`);
  }
  includes(html("progress"), 'id="weightForm"', "progress weight form");
  includes(html("progress"), 'id="measurementsForm"', "progress measurements form");
  includes(html("progress"), 'id="photosForm"', "progress photo form");
  includes(html("progress"), 'role="status"', "progress status");
});

test("responsive shell contracts cover the requested desktop, tablet and mobile breakpoints", () => {
  const dashboardCss = css("dashboard");
  assert.match(dashboardCss, /\.dashboard-primary-actions\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)/, "desktop quick actions use five columns");
  assert.match(dashboardCss, /@media\s*\(min-width:\s*521px\)\s*and\s*\(max-width:\s*1080px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)/, "tablet quick actions use three columns");
  assert.match(dashboardCss, /@media\s*\(max-width:\s*520px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr\s+1fr/, "mobile quick actions use two columns");
  assert.match(dashboardCss, /@media\s*\(max-width:\s*360px\)[\s\S]*?\.dashboard-primary-actions\s*\{[\s\S]*?grid-template-columns:\s*1fr/, "narrow mobile quick actions use one column");

  for (const sheet of ["dashboard", "social"]) {
    assert.match(css(sheet), /overflow-x\s*:\s*(?:hidden|clip)/, `${sheet} prevents horizontal overflow`);
  }
});

test("local-only coverage does not introduce production credentials or external bypasses", () => {
  const allowedSourceFiles = [
    "server.js",
    "public/js/firebase-config.js",
    "public/js/imagekit-upload.js",
    "public/js/progress.js"
  ];
  for (const relativePath of allowedSourceFiles) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /sk-[A-Za-z0-9]{20,}/, `${relativePath} contains no OpenAI secret`);
  }
  const socialTest = read("test/social-two-user-journey.test.js");
  includes(socialTest, "example.test", "social synthetic accounts");
  assert.doesNotMatch(socialTest, /fuelphysique\.com|firebaseapp\.com/i, "social test has no production endpoint");
  assert.doesNotMatch(socialTest, /MOCK_EXTERNAL_SERVICES\s*=\s*false/i, "social test does not disable local isolation");
});
