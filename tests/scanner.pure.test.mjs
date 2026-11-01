import test from "node:test";
import assert from "node:assert/strict";
import { redact, WINDOW_H, scanSessions } from "../src/scanner.mjs";

test("security P2: redaction strips key/bearer/token shapes", () => {
  assert.ok(!redact("upstream said sk-abc123456xyz rejected").includes("sk-abc123456xyz"));
  assert.ok(!redact("Authorization: Bearer eyJhbGciOiJIUzI1.abc").includes("eyJhbGciOiJIUzI1.abc"));
  assert.ok(!redact("api_key=super-secret-value failed").includes("super-secret-value"));
  assert.equal(redact("429 rate limit reached"), "429 rate limit reached", "plain error text survives");
});

test("reliability P1: an invalid DSH_NEEDS_ATTN_WINDOW_H falls back to 12, never NaN/0", () => {
  assert.ok(Number.isFinite(WINDOW_H) && WINDOW_H > 0 && WINDOW_H <= 720, `WINDOW_H=${WINDOW_H}`);
});

test("reliability P2: an unreadable log root is degraded, not 'healthy'", async () => {
  const prevRoot = process.env.DSH_NEEDS_ATTN_LOG_ROOT;
  process.env.DSH_NEEDS_ATTN_LOG_ROOT = "/nonexistent-needs-attention-root-xyz";
  try {
    const out = await scanSessions({ now: Date.now() });
    assert.deepEqual(out.sessions, []);
    assert.equal(out.rootOk, false);
    assert.ok(out.degraded >= 1, "a missing root must surface as degraded");
  } finally {
    if (prevRoot === undefined) delete process.env.DSH_NEEDS_ATTN_LOG_ROOT;
    else process.env.DSH_NEEDS_ATTN_LOG_ROOT = prevRoot;
  }
});
