import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyError, deriveRow, reduceEvents } from "../src/scanner.mjs";

const snap = JSON.parse(readFileSync(new URL("./fixtures/snapshot.json", import.meta.url), "utf8"));
const EXPECTED = { red: "fatal", amber: "limit" };

test("G2: classifier matches proto ground truth on all 32 real samples", () => {
  const errs = snap.sessions.filter((s) => s.error);
  assert.equal(errs.length, 32);
  for (const s of errs) {
    const got = classifyError(s.error.message);
    assert.equal(
      got, EXPECTED[s.error.level],
      `sample ${s.id}: "${String(s.error.message).slice(0, 60)}" expected ${EXPECTED[s.error.level]} got ${got}`,
    );
  }
});

test("REQ-005: a later successful terminal event clears the listing", () => {
  const cleared = deriveRow("session-x", [
    { time: 1, kind: "error", message: "429 rate_limit_error [1302]" },
    { time: 2, kind: "success", message: "" },
  ], "T");
  assert.equal(cleared, null);
});

test("REQ-004: aborted terminal event is fatal; 429 message is limit", () => {
  assert.equal(deriveRow("session-y", [{ time: 1, kind: "aborted", message: "turn aborted" }], "T").severity, "fatal");
  assert.equal(deriveRow("session-z", [{ time: 5, kind: "error", message: "429 rate_limit_error [1302]" }], "T").severity, "limit");
});

/* Review P1-A regression: the old scanner stopped at line 60_000 reading from the
   HEAD, so on a long session (87k lines measured) the newest events were never
   seen — a healthy session was fabricated as fatal. reduceEvents must be a ring
   over the WHOLE stream: the latest terminal event wins regardless of length. */
test("P1-A: latest terminal event wins on a 90k-line stream (no head truncation)", () => {
  const red = reduceEvents();
  for (let i = 0; i < 90_000; i++) {
    red.push({ type: "noise", time: i });
  }
  red.push({ type: "turn/end", time: 100_000, data: { reason: { kind: "error", error: { message: "429 rate_limit_error [1302]" } } } });
  red.push({ type: "turn/end", time: 200_000, data: { reason: { kind: "success" } } });
  const { events, title } = red.result();
  assert.equal(deriveRow("session-long", events, title), null, "later success must clear even after 90k lines");
});

test("P1-A: ring keeps only the last 50 terminal events (bounded memory)", () => {
  const red = reduceEvents();
  for (let i = 1; i <= 500; i++) {
    red.push({ type: "turn/end", time: i, data: { reason: { kind: i % 2 ? "error" : "success" } } });
  }
  const { events } = red.result();
  assert.equal(events.length, 50);
  assert.equal(events[events.length - 1].time, 500, "newest event retained");
  assert.equal(events[0].time, 451, "oldest kept = ring boundary");
});
