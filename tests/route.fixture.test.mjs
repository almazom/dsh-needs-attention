import test from "node:test";
import assert from "node:assert/strict";
import { registerRoutes, ROUTE_PATH, makeGuard } from "../src/host.mjs";

const FIXTURE = [
  { id: "session-fixture-dead", title: "Canary 1+2", severity: "fatal", lastError: "500 api_error [1234] Internal", at: 1 },
];

const FIXTURE_V2 = { sessions: FIXTURE, total: 7, windowH: 12, degraded: 2, at: 123456789 };

const loopbackReq = (method = "GET") => ({ method, socket: { remoteAddress: "127.0.0.1" } });
const remoteReq = (method = "GET") => ({ method, socket: { remoteAddress: "203.0.113.9" } });

function makeCtx(connection) {
  const routes = [];
  const webServer = { register(opts) { routes.push(opts); return () => {}; } };
  const ctx = {
    connection,
    inject(deps, fn) {
      assert.deepEqual(deps, ["webServer"]);
      fn({ webServer, effect(f) { f(); } });
    },
  };
  return { ctx, routes };
}

function makeRes() {
  return {
    statusCode: 0, headers: {}, body: "",
    setHeader(k, v) { this.headers[k] = v; },
    end(b) { this.body = b ?? ""; },
  };
}

test("G4(fixture): GET route registers (kind=exact), answers 200 to a loopback peer, warm <=200ms", async () => {
  const { ctx, routes } = makeCtx();
  registerRoutes(ctx, { scanner: async () => FIXTURE_V2 });
  assert.equal(routes.length, 1);
  assert.equal(routes[0].kind, "exact");
  assert.equal(routes[0].path, ROUTE_PATH);
  const res = makeRes();
  const t0 = performance.now();
  await routes[0].handler(loopbackReq(), res);
  const dt = performance.now() - t0;
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.sessions[0].id, "session-fixture-dead");
  assert.equal(body.total, 7);
  assert.equal(body.degraded, 2);
  assert.equal(body.windowH, 12);
  assert.equal(res.headers["Cache-Control"], "no-store", "session titles must not be cached");
  assert.ok(dt < 200, `warm route took ${dt}ms (>200ms)`);
});

test("P0 guard: non-loopback peer without a connection face is denied (fail-closed)", async () => {
  const { ctx, routes } = makeCtx(undefined);
  registerRoutes(ctx, { scanner: async () => FIXTURE_V2 });
  const res = makeRes();
  await routes[0].handler(remoteReq(), res);
  assert.equal(res.statusCode, 403);
  assert.equal(JSON.parse(res.body).ok, false);
});

test("P0 guard: connection.requestRejection 401/403 → rejected, 200 → allowed", async () => {
  for (const [code, expected] of [[401, 401], [403, 403]]) {
    const { ctx, routes } = makeCtx({ requestRejection: () => code });
    registerRoutes(ctx, { scanner: async () => FIXTURE_V2 });
    const res = makeRes();
    await routes[0].handler(remoteReq(), res);
    assert.equal(res.statusCode, expected, `rejection ${code} must surface as ${expected}`);
  }
  const { ctx, routes } = makeCtx({ requestRejection: () => 0 });
  registerRoutes(ctx, { scanner: async () => FIXTURE_V2 });
  const res = makeRes();
  await routes[0].handler(remoteReq(), res);
  assert.equal(res.statusCode, 200, "authenticated remote peer passes");
});

test("P0 guard: non-GET is 405 before any work", async () => {
  const { ctx, routes } = makeCtx({ requestRejection: () => 0 });
  registerRoutes(ctx, { scanner: async () => FIXTURE_V2 });
  const res = makeRes();
  await routes[0].handler({ method: "POST", socket: { remoteAddress: "127.0.0.1" } }, res);
  assert.equal(res.statusCode, 405);
});

test("legacy array-shaped scanner result still answers 200 (backward compat)", async () => {
  const { ctx, routes } = makeCtx();
  registerRoutes(ctx, { scanner: async () => FIXTURE });
  const res = makeRes();
  await routes[0].handler(loopbackReq(), res);
  assert.equal(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.equal(body.sessions.length, 1);
  assert.equal(body.degraded, 0);
});

test("route fails soft: scanner throw → 500, no raw error text leaked", async () => {
  const { ctx, routes } = makeCtx();
  registerRoutes(ctx, { scanner: async () => { throw new Error("boom /Users/secret/path"); } });
  const res = makeRes();
  await routes[0].handler(loopbackReq(), res);
  assert.equal(res.statusCode, 500);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, false);
  assert.equal(body.error, "scan-failed");
  assert.ok(!JSON.stringify(body).includes("/Users/secret"), "raw error text must not be echoed");
});

test("makeGuard with a connection face never denies an authenticated peer", () => {
  const guard = makeGuard({ requestRejection: () => 0 });
  const res = makeRes();
  assert.equal(guard(remoteReq(), res), true);
});

test("reliability P2: a hung scanner is bounded by the route deadline (504, not a hung request)", async () => {
  process.env.DSH_NEEDS_ATTN_DEADLINE_MS = "40";
  try {
    const mod = await import(`../src/host.mjs?deadline=${Date.now()}`);
    const routes = [];
    const ctx = { inject(_d, fn) { fn({ webServer: { register(o) { routes.push(o); return () => {}; } }, effect(f) { f(); } }); } };
    mod.registerRoutes(ctx, { scanner: () => new Promise(() => {}) });
    const res = makeRes();
    await routes[0].handler(loopbackReq(), res);
    assert.equal(res.statusCode, 504);
    assert.equal(JSON.parse(res.body).error, "scan-timeout");
  } finally {
    delete process.env.DSH_NEEDS_ATTN_DEADLINE_MS;
  }
});
