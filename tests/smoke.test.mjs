import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("package.json: bundle patch + web client platform", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.equal(pkg.name, "@almazom/dsh-needs-attention");
  assert.equal(pkg.dsh.bundle.patch, "./cordis.patch.yml");
  assert.equal(pkg.dsh.client.platform, "web");
});

test("cordis.patch.yml: exactly one insert row, unique id", () => {
  const y = readFileSync(join(root, "cordis.patch.yml"), "utf8");
  assert.match(y, /- insert:/);
  const ids = [...y.matchAll(/^\s*-\s*id:\s*(\S+)/gm)].map((m) => m[1]);
  assert.deepEqual(ids, ["needs-attention"]);
});

test("client.js: ModuleLoader lazy load + once-guard", () => {
  const c = readFileSync(join(root, "src", "client.js"), "utf8");
  assert.match(c, /__ModuleLoader__\.load/);
  assert.match(c, /__DSH_NA__/);
});

test("index.mjs: inert-safe host entry (name/inject/apply)", async () => {
  const mod = await import(join(root, "index.mjs") + `?t=${Date.now()}`);
  assert.equal(mod.name, "@almazom/dsh-needs-attention");
  /* the route needs `connection` so it can apply the same admission check as the
     GUI: exact-table routes under /api bypass the prefix gate (P0, 2026-10-30) */
  assert.deepEqual(mod.inject, ["webServer", "connection"]);
  assert.equal(typeof mod.apply, "function");
  assert.doesNotThrow(() => mod.apply()); // stub apply is safe with no ctx
});
