/* Static contract guard for the DOM anchor (no jsdom in this package).
 *
 * The anchor is the one seam that can silently kill the whole block: it used to
 * match the header text "Workspaces" only, so a sidebar in the flat view
 * (WorkspaceBrowser.tsx renders t('section.sessions') when groupBy === 'flat')
 * rendered no block at all while the plugin was live in the boot graph
 * (2026-10-31 operator report). A second miss — a sidebar drawn by another
 * plugin with different class names — produced the same silence, so the anchor
 * now walks an ordered fallback chain and a miss is published on
 * `window.__DNA_STATUS__` instead of vanishing. These tests fail if either
 * guarantee is removed.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "client.js"), "utf8");

test("anchor matches both sidebar section labels (grouped + flat view)", () => {
  const m = src.match(/var SECTION_LABELS = \[([^\]]+)\]/);
  assert.ok(m, "SECTION_LABELS list is missing");
  for (const label of ["Workspaces", "工作区", "Sessions", "会话"]) {
    assert.ok(m[1].includes(`"${label}"`), `anchor must accept ${label}`);
  }
});

test("anchor walks an ordered fallback chain instead of one selector", () => {
  const fn = src.match(/function findAnchor\(\) \{[\s\S]*?\n    \}/);
  assert.ok(fn, "findAnchor is missing");
  const order = ['how: "label:', 'how: "sectionLabel:', 'how: "sectionHeader"', 'how: "sidebar"'];
  let last = -1;
  for (const step of order) {
    const at = fn[0].indexOf(step);
    assert.ok(at > last, `fallback step ${step} missing or out of order`);
    last = at;
  }
});

test("a miss is published, not silent (window.__DNA_STATUS__)", () => {
  assert.match(src, /window\.__DNA_STATUS__/, "no diagnostic surface: a miss is unreadable from the browser");
  assert.match(src, /err: "no-anchor"/, "a missing anchor must be reported with a reason");
  assert.match(src, /setStatus\(\{ booted: true/, "boot must publish that the client ran at all");
});

test("anchor never attaches to the document body (product P3)", () => {
  assert.ok(!/document\.body\.prepend|querySelector\("body"\)/.test(src), "block must never attach to body");
});
