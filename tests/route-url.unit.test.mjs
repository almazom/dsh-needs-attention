/* The data route must stay inside the panel's mount prefix.
 *
 * 2026-10-31 operator report: the page at https://dsh-abu.ru/stable/duty kept the
 * block hidden and the console said
 *   [needs-attention] refresh failing: … Unexpected end of JSON input
 * because the client fetched a hardcoded "/api/dsh-needs-attention/sessions",
 * which leaves the /stable mount, lands on the edge root and answers an empty
 * body. The boot HTML writes plugin URLs RELATIVE ("plugins/??…") for exactly
 * this reason. The anchor fix was fine; this was the real blocker on his screen.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "src", "client.js"), "utf8");
const REL = "api/dsh-needs-attention/sessions";

function resolveAt(pageUrl) {
  return new URL(REL, pageUrl).pathname;
}

test("route stays under the mount prefix at every page depth", () => {
  assert.equal(resolveAt("https://dsh-abu.ru/"), "/api/dsh-needs-attention/sessions");
  assert.equal(resolveAt("https://dsh-abu.ru/duty"), "/api/dsh-needs-attention/sessions");
  assert.equal(resolveAt("https://dsh-abu.ru/stable/duty"), "/stable/api/dsh-needs-attention/sessions");
  assert.equal(resolveAt("https://dsh-abu.ru/stable/"), "/stable/api/dsh-needs-attention/sessions");
});

test("client never fetches an absolute /api path again", () => {
  assert.ok(!/fetch\(\s*["']\/api\//.test(src), "hardcoded absolute /api fetch would leave the mount");
  assert.match(src, /new URL\(ROUTE_REL, document\.baseURI\)/, "route must resolve against document.baseURI");
  assert.match(src, /var ROUTE_REL = "api\//, "route constant must be relative");
});
