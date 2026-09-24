const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const landing = fs.readFileSync(path.join(root, "public", "index.html"), "utf8");
const server = fs.readFileSync(path.join(root, "server.js"), "utf8");

test("landing footer exposes the official FuelPhysique social profiles safely", () => {
  for (const url of [
    "https://www.instagram.com/fuel_physique?stkn=MWhrbDlzejdqcTQ0bQ==",
    "https://youtube.com/@fuelphysique?si=-Sg-7MDN0t02JcTG",
    "https://www.tiktok.com/@fuelphysique1?_r=1&amp;_t=ZS-99zPZuqblbA"
  ]) {
    assert.match(landing, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(landing, /class="landing-footer-social"/);
  assert.equal((landing.match(/target="_blank" rel="noopener noreferrer"/g) || []).length, 3);
});

test("the social footer remains self-contained and does not add a third-party icon dependency", () => {
  assert.doesNotMatch(landing, /cdn\.simpleicons\.org/);
  assert.doesNotMatch(server, /cdn\.simpleicons\.org/);
});
