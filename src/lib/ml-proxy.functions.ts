import { createServerFn } from "@tanstack/react-start";

const PATHS = ["/health", "/predict/delivery", "/predict/installation"] as const;
type Path = (typeof PATHS)[number];
const MAX_BODY_BYTES = 4096;
const MAX_RESPONSE_BYTES = 16_384;

/**
 * Same-origin relay to the ML API (the API sends no CORS headers).
 * - Destination host is chosen on the server only (never from the caller).
 * - Only the three known endpoints are allowed.
 * - Prediction bodies must be `{ features }` passing the training-vocabulary check;
 *   they are re-serialised so no extra fields are forwarded.
 * - No secrets or credentials are used or forwarded; upstream errors are reduced to a status code.
 */
export const mlProxy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => {
    const i = input as { path?: unknown; body?: unknown } | null;
    if (!i || typeof i.path !== "string" || !(PATHS as readonly string[]).includes(i.path)) throw new Error("Unsupported ML path");
    const path = i.path as Path;
    if (path === "/health") return { path, body: null };
    if (typeof i.body !== "string" || i.body.length > MAX_BODY_BYTES) throw new Error("Invalid prediction body");
    let parsed: unknown;
    try {
      parsed = JSON.parse(i.body);
    } catch {
      throw new Error("Invalid prediction body");
    }
    const p = parsed as { features?: unknown } | null;
    if (!p || typeof p !== "object" || Object.keys(p).length !== 1 || !("features" in p)) throw new Error("Invalid prediction body");
    return { path, body: p.features };
  })
  .handler(async ({ data }) => {
    const { getMlApiBaseUrl, validateFeaturePayload } = await import("@/lib/ml-api");
    if (data.path !== "/health") {
      const errs = validateFeaturePayload(data.body);
      if (errs.length) return { reachable: true as const, status: 422, text: JSON.stringify({ detail: "Invalid features" }) };
    }
    try {
      const res = await fetch(`${getMlApiBaseUrl()}${data.path}`, {
        method: data.path === "/health" ? "GET" : "POST",
        headers: { "Content-Type": "application/json" },
        body: data.path === "/health" ? null : JSON.stringify({ features: data.body }),
        // The edge runtime rejects redirect:"error"; "manual" + refusing any 3xx keeps redirects blocked.
        redirect: "manual",
        signal: AbortSignal.timeout(55_000),
      });
      if (res.status >= 300 && res.status < 400) return { reachable: true as const, status: 502, text: "" };
      const text = await res.text();
      if (!res.ok) return { reachable: true as const, status: res.status, text: "" };
      return { reachable: true as const, status: res.status, text: text.length > MAX_RESPONSE_BYTES ? "" : text };
    } catch (e) {
      console.error("[mlProxy] upstream fetch failed:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
      return { reachable: false as const, status: 0, text: "" };
    }
  });
