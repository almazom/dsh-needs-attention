/**
 * host.mjs — GET /api/dsh-needs-attention/sessions via ctx.inject webServer.
 *
 * SECURITY (P0, measured 2026-10-30): exact-table routes under /api are matched
 * BEFORE the connection /api prefix gate (packages/host/webserver/src/index.ts:543-549),
 * so a plugin route without its own admission check answers 200 without a cookie —
 * measured on loopback, LAN, tailnet AND the public edge, incl. a forged Host.
 * Guard mirrors the shipped precedent dsh-p2i-viz/src/routes.ts:100-112:
 * use `connection.requestRejection(req)` when available, else deny non-loopback.
 * Also: GET only (405), Cache-Control: no-store, and no raw error text in bodies.
 */
import { scanSessions } from "./scanner.mjs";

export const ROUTE_PATH = "/api/dsh-needs-attention/sessions";

/* A cold scan of a heavy store can take seconds; an unbounded one once measured
   ~733 s worst case (reliability review). Bound the request, fail loudly. */
const SCAN_DEADLINE_MS = Number(process.env.DSH_NEEDS_ATTN_DEADLINE_MS) > 0 ? Number(process.env.DSH_NEEDS_ATTN_DEADLINE_MS) : 10_000;

function withDeadline(promise, ms) {
  let timer;
  const deadline = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("scan-timeout")), ms); });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}

function writeJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

/** Admission guard. Fail-closed: no connection face → only loopback peers pass. */
export function makeGuard(connection) {
  return (req, res) => {
    if (connection && typeof connection.requestRejection === "function") {
      const rejection = connection.requestRejection(req);
      if (rejection === 403) { writeJson(res, 403, { ok: false, error: "forbidden" }); return false; }
      if (rejection === 401) { writeJson(res, 401, { ok: false, error: "unauthorized" }); return false; }
      return true;
    }
    const remote = req?.socket?.remoteAddress ?? "";
    if (remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1") return true;
    writeJson(res, 403, { ok: false, error: "forbidden" });
    return false;
  };
}

export function registerRoutes(ctx, { scanner = scanSessions, connection = ctx?.connection } = {}) {
  ctx.inject(["webServer"], (webCtx) => {
    const guard = makeGuard(connection);
    webCtx.effect(() =>
      webCtx.webServer.register({
        kind: "exact",
        path: ROUTE_PATH,
        handler: async (req, res) => {
          if (req?.method !== "GET") return writeJson(res, 405, { ok: false, error: "method-not-allowed" });
          if (!guard(req, res)) return;
          try {
            const out = await withDeadline(Promise.resolve().then(scanner), SCAN_DEADLINE_MS);
            const sessions = Array.isArray(out) ? out : out?.sessions ?? [];
            writeJson(res, 200, {
              ok: true,
              at: Date.now(),
              sessions,
              total: Array.isArray(out) ? out.length : out?.total ?? sessions.length,
              degraded: Array.isArray(out) ? 0 : out?.degraded ?? 0,
              windowH: Array.isArray(out) ? null : out?.windowH ?? null,
            });
          } catch (err) {
            const timedOut = String(err?.message ?? "") === "scan-timeout";
            writeJson(res, timedOut ? 504 : 500, { ok: false, error: timedOut ? "scan-timeout" : "scan-failed", sessions: [] });
          }
        },
      }),
    );
  });
}
