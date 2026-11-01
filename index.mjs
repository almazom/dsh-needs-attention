// @almazom/dsh-needs-attention — host entry: registers the sessions route.
// The browser half lives in src/client.js (dsh.client.platform: web).
// `connection` is injected so the route can apply the same admission check as the
// GUI (the /api prefix gate does NOT cover exact-table routes — P0, 2026-10-30).
import { registerRoutes } from "./src/host.mjs";

export const name = "@almazom/dsh-needs-attention";
export const inject = ["webServer", "connection"];

export function apply(ctx) {
  try {
    registerRoutes(ctx, { connection: ctx?.connection });
  } catch (err) {
    console.warn("[dsh-needs-attention] webServer absent — client-only degraded:", err?.message);
  }
}

export default { name, inject, apply };
