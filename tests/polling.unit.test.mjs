/* Operator expectation (2026-10-31, m01347): a session that recovered must LEAVE
 * the list promptly — "если сессия перестала быть проблемной … она должна исчезнуть
 * из этого списка". The backend already clears it (last terminal event wins, REQ-005);
 * what he saw was the client's 30 s cadence. The block now polls every 10 s while it
 * shows rows, 30 s while empty, and immediately on focus.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "client.js"), "utf8");

test("an occupied block polls 10 s, an empty one 30 s", () => {
  assert.match(src, /var POLL_ACTIVE_MS = 10000;/);
  assert.match(src, /var POLL_EMPTY_MS = 30000;/);
  assert.match(src, /document\.querySelector\("\[data-dna-block\]"\) \? POLL_ACTIVE_MS : POLL_EMPTY_MS/);
});

test("polling is self-scheduling and also fires on window focus", () => {
  assert.match(src, /\.then\(schedule, schedule\)/, "a poll must schedule the next one on success AND failure");
  assert.match(src, /window\.addEventListener\("focus", function \(\) \{ poll\(\); \}\)/);
  assert.ok(!/setInterval\(poll/.test(src), "a fixed interval cannot adapt to an occupied block");
});

test("dispose clears the timeout", () => {
  assert.match(src, /clearTimeout\(pollTimer\)/);
});
