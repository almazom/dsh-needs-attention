import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/* Review-round-2 gap: "never silent" died on (a) a non-zero zstdcat exit and
   (b) the failure cache — degraded counted once, then 0 forever. This locks both. */
test("P2-3: non-zero zstdcat exit → degraded, and the cached failure keeps counting", async () => {
  const root = mkdtempSync(join(tmpdir(), "na-root-"));
  const sd = join(root, "ws-1", "session-deadbeef");
  mkdirSync(sd, { recursive: true });
  writeFileSync(join(sd, "session.v4.jsonl.zstd"), "not really zstd");

  const bin = mkdtempSync(join(tmpdir(), "na-bin-"));
  const fake = join(bin, "zstdcat");
  writeFileSync(fake, "#!/bin/sh\nexit 3\n");
  chmodSync(fake, 0o755);

  const prevPath = process.env.PATH;
  const prevRoot = process.env.DSH_NEEDS_ATTN_LOG_ROOT;
  const prevWindow = process.env.DSH_NEEDS_ATTN_WINDOW_H;
  process.env.PATH = bin + ":" + prevPath;
  process.env.DSH_NEEDS_ATTN_LOG_ROOT = root;
  process.env.DSH_NEEDS_ATTN_WINDOW_H = "24";

  try {
    const { scanSessions } = await import("../src/scanner.mjs");
    const t0 = Date.now();
    const s1 = await scanSessions({ now: t0 });
    assert.equal(s1.degraded, 1, "garbage log must be reported as degraded");
    assert.equal(s1.sessions.length, 0, "nothing may be fabricated from an unreadable log");

    const s2 = await scanSessions({ now: t0 + 60_000 }); // past the 20 s throttle → rescan, cache hit
    assert.equal(s2.degraded, 1, "a cached failure must keep counting on later polls");
  } finally {
    process.env.PATH = prevPath;
    if (prevRoot === undefined) delete process.env.DSH_NEEDS_ATTN_LOG_ROOT;
    else process.env.DSH_NEEDS_ATTN_LOG_ROOT = prevRoot;
    if (prevWindow === undefined) delete process.env.DSH_NEEDS_ATTN_WINDOW_H;
    else process.env.DSH_NEEDS_ATTN_WINDOW_H = prevWindow;
  }
});
