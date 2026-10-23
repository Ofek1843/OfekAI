"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const { parseHTML } = require("linkedom");
const { features, hub, ORIGIN } = require("../lib/seo-feature-content");
const { renderFeature, renderHub, previewMarkup } = require("../lib/seo-feature-pages");
const router = require("../lib/seo-feature-router");
const publicDir = path.join(__dirname, "../public");
const pages = [...features, hub];
const generated = page => page === hub ? renderHub() : renderFeature(page);

test("illustrative workout uses supported catalog movements and passes program validation", () => {
  const { workoutExample: example } = require("../lib/seo-feature-examples");
  const { validateWorkoutProgram } = require("../lib/workout-validator");
  const { getCatalogExercise } = require("../lib/workout-exercise-catalog");
  const result = validateWorkoutProgram(example.program, example.profile);
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(result.warnings, []);
  const { document } = parseHTML(renderFeature(features.find(page => page.id === "workout-plan-generator")));
  assert.equal(document.querySelectorAll(".week-preview li").length, 7);
  assert.equal(document.querySelectorAll(".week-preview .training-day").length, example.profile.daysPerWeek);
  assert.match(document.querySelector("#example").textContent, /editorial example, not a live generated result/);
  const rows = [...document.querySelectorAll(".session-grid tbody tr")];
  const exercises = example.program.sessions.flatMap(session => session.exercises);
  assert.equal(rows.length, exercises.length);
  exercises.forEach((exercise, index) => {
    const entry = getCatalogExercise(exercise.exerciseId);
    assert.ok(entry.publicGeneration && !entry.disabled);
    assert.equal(rows[index].querySelector("th").textContent, entry.title);
    assert.equal(rows[index].querySelector("td").textContent, `${exercise.sets} × ${exercise.reps}`);
  });
});

test("meal ingredients, displayed portions, meal estimates and both daily totals agree", () => {
  const { mealExample, mealTotals } = require("../lib/seo-feature-examples");
  const { FOODS, getMealById } = require("../lib/meal-catalog");
  const { document } = parseHTML(renderFeature(features.find(page => page.id === "meal-plan-generator")));
  assert.match(document.querySelector(".intro").textContent, /personalized one-day meal plan/);
  const cards = [...document.querySelectorAll(".meal-example-grid .example-card")];
  assert.equal(cards.length, mealExample.length);
  let dayCalories = 0, dayProtein = 0;
  mealExample.forEach((meal, index) => {
    assert.ok(getMealById(meal.mealId));
    const rows = [...cards[index].querySelectorAll("tbody tr")];
    assert.equal(rows.length, meal.foods.length);
    let calories = 0, protein = 0;
    meal.foods.forEach((food, rowIndex) => {
      const reference = FOODS[food.catalogKey];
      assert.ok(reference);
      assert.ok(food.grams > 0);
      // Independently verify the product's per-100g arithmetic and displayed rows.
      assert.equal(food.calories, Math.round(reference.kcal * food.grams / 100));
      assert.equal(food.proteinGrams, Math.round(reference.p * food.grams / 100));
      const cells = [...rows[rowIndex].querySelectorAll("th,td")].map(cell => cell.textContent);
      assert.deepEqual(cells, [food.name, food.amount, String(food.calories), `${food.proteinGrams} g`]);
      calories += food.calories;
      protein += food.proteinGrams;
    });
    assert.equal(meal.optionCalories, calories);
    assert.equal(meal.optionProteinGrams, protein);
    assert.deepEqual([...cards[index].querySelectorAll("tfoot td")].map(cell => cell.textContent), [String(calories), `${protein} g`]);
    dayCalories += calories;
    dayProtein += protein;
  });
  assert.deepEqual(mealTotals, { calories: dayCalories, proteinGrams: dayProtein });
  assert.equal(document.querySelectorAll(".example-totals").length, 2);
  for (const summary of document.querySelectorAll(".example-totals")) {
    assert.deepEqual([...summary.querySelectorAll("dd")].map(cell => cell.textContent), [`${dayCalories.toLocaleString("en-US")} kcal`, `${dayProtein} g`]);
  }
});

test("generator examples have accessible table headings and connected workflow links", () => {
  const connectedIds = ["workout-plan-generator", "meal-plan-generator", "nutrition-tracker", "training-volume"];
  for (const id of connectedIds) {
    const page = features.find(item => item.id === id);
    const { document } = parseHTML(renderFeature(page));
    for (const other of connectedIds.filter(item => item !== id)) {
      const target = features.find(item => item.id === other);
      assert.ok(document.querySelector(`[aria-labelledby="related-title"] a[href="${target.route}"]`), `${id} -> ${other}`);
    }
    for (const table of document.querySelectorAll(".example-table")) {
      assert.ok(table.querySelector("caption")?.textContent);
      assert.ok(table.querySelectorAll('th[scope="col"]').length >= 3);
      assert.equal(table.querySelectorAll("tbody tr").length, table.querySelectorAll('tbody th[scope="row"]').length);
    }
  }
});

test("committed HTML equals the deterministic renderer; no browser rendering needed", () => {
  for (const page of pages) {
    const source = fs.readFileSync(path.join(publicDir, page.file), "utf8").replace(/\r\n/g, "\n");
    assert.equal(source, generated(page), `${page.route}: run build`);
    const { document } = parseHTML(source);
    assert.equal(document.querySelectorAll("h1").length, 1);
    assert.equal(document.querySelector("h1").textContent, page.h1);
    assert.equal(document.querySelector('link[rel="canonical"]').href, ORIGIN + page.route);
    assert.equal(document.querySelector('link[rel="icon"]').href, "/images/brand/fuelphysique-icon-192.png");
    assert.equal(document.querySelectorAll('meta[name="description"]').length, 1);
    assert.equal(document.querySelector('meta[name="robots"]').content, "index,follow");
    assert.equal(document.querySelectorAll('script[src*="google-analytics-consent"]').length, 1);
    assert.equal(document.querySelectorAll('script[src*="seo-features.js"]').length, 1);
    assert.doesNotMatch(source, /firebase-config|fetch\(|localStorage|loading\.\.\./i);
    const graph = JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent)["@graph"];
    assert.deepEqual(graph.map(node => node["@type"]), ["WebPage", "BreadcrumbList"]);
    assert.equal(graph[0].url, ORIGIN + page.route);
    assert.doesNotMatch(JSON.stringify(graph), /"aggregateRating"|"@type":"(?:FAQPage|Review)"|"offers"/);
    if (page !== hub) {
      assert.equal(document.querySelectorAll("details").length, page.faqs.length);
      assert.equal(document.querySelectorAll(".steps li").length, page.steps.length);
      for (const cta of document.querySelectorAll("[data-seo-cta]")) {
        assert.equal(cta.getAttribute("href"), page.destination);
      }
    }
  }
  assert.equal(new Set(pages.map(page => page.title)).size, pages.length);
  assert.equal(new Set(pages.map(page => page.description)).size, pages.length);
});

test("all local links, CTA destinations, assets and in-page anchors exist", () => {
  const canonicalRoutes = new Set(pages.map(page => page.route));
  for (const page of pages) {
    const { document } = parseHTML(generated(page));
    for (const element of document.querySelectorAll("[href], [src]")) {
      const href = element.getAttribute("href") || element.getAttribute("src");
      const url = new URL(href, ORIGIN + page.route);
      if (url.origin !== ORIGIN) continue;
      if (href.startsWith("#")) {
        assert.ok(document.getElementById(url.hash.slice(1)), `${page.route} ${href}`);
        continue;
      }
      if (canonicalRoutes.has(url.pathname) || url.pathname === "/exercise-library") continue;
      const target = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
      assert.ok(fs.existsSync(path.join(publicDir, target)), `${page.route} -> ${href}`);
    }
  }
});

test("homepage previews are reused without unresolved translation templates", () => {
  for (const name of ["workout", "nutrition", "diary", "tracker", "progress"]) {
    const markup = previewMarkup(name);
    assert.doesNotMatch(markup, /\$\{|<script|<input|<button/);
    assert.ok(markup.length > 300);
  }
});

test("public routing works without auth; aliases redirect, unknown routes are real 404s", async t => {
  const app = express();
  app.use(router);
  app.use(express.static(publicDir));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const page of pages) {
    const response = await fetch(base + page.route);
    assert.equal(response.status, 200, page.route);
    assert.match(response.headers.get("content-type"), /text\/html/);
    assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
    assert.equal(await response.text(), generated(page));
    assert.equal((await fetch(base + page.route, { method: "HEAD" })).status, 200);
    for (const alias of [page.route + "/", page.route.toUpperCase(), "/" + page.file]) {
      if (alias === page.route) continue;
      const redirect = await fetch(base + alias + "?utm_source=test", { redirect: "manual" });
      assert.equal(redirect.status, 301, alias);
      assert.equal(redirect.headers.get("location"), page.route + "?utm_source=test");
    }
  }
  for (const route of ["/features/missing", "/features/../../private", "/features/unknown.html"]) {
    assert.equal((await fetch(base + route)).status, 404, route);
  }
  for (const route of ["/features/workout-plan-generator", "/features/workout-plan-generator.html"]) {
    const response = await fetch(base + route, { redirect: "manual" });
    assert.equal(response.status, 301);
    assert.equal(response.headers.get("location"), "/workout-plan-generator.html");
  }
  assert.equal((await fetch(base + "/sitemap.xml")).status, 200);
  assert.equal((await fetch(base + "/robots.txt")).status, 200);
  const favicon = await fetch(base + "/favicon.ico", { redirect: "manual" });
  assert.equal(favicon.status, 301);
  assert.equal(favicon.headers.get("location"), "/images/brand/fuelphysique-icon-192.png");
  const faviconHead = await fetch(base + "/favicon.ico", { method: "HEAD", redirect: "manual" });
  assert.equal(faviconHead.status, 301);
  assert.equal(faviconHead.headers.get("location"), favicon.headers.get("location"));
  const icon = await fetch(base + favicon.headers.get("location"));
  assert.equal(icon.status, 200);
  assert.match(icon.headers.get("content-type"), /image\/png/);
});
