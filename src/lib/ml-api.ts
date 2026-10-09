/**
 * Typed client for the SYNOVA AI ML prediction API (hackathon prototype).
 * The models are trained on synthetic data only; scores are not validated
 * real-world probabilities.
 */
import type { Order } from "@/data/demo-orders";
import { mlProxy } from "@/lib/ml-proxy.functions";
import {
  CARRIER_IDS, DELIVERY_ZONES, DISPATCH_STATUSES_AT_CUTOFF, INSTALL_SCHEDULING_AT_CUTOFF,
  type CarrierId, type DeliveryZone,
} from "@/ml/schema";

export const DEFAULT_ML_API_BASE_URL = "https://synova-ai-ml-api.onrender.com";

/** Only https origins without path/credentials are accepted; anything else falls back to the default. */
export function getMlApiBaseUrl(): string {
  const v = (import.meta.env["VITE_SYNOVA_API_BASE_URL"] as string | undefined)?.trim().replace(/\/+$/, "");
  return v && /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(v) ? v : DEFAULT_ML_API_BASE_URL;
}

/**
 * Category vocabularies are taken from the training dataset schema (src/ml/schema.ts).
 * The deployed API accepts any string and silently ignores unknown categories,
 * so values outside these lists are rejected here before any request is sent.
 */
export const ML_CATEGORIES = {
  deliveryZone: DELIVERY_ZONES,
  carrierId: CARRIER_IDS,
  dispatchStatusAtCutoff: DISPATCH_STATUSES_AT_CUTOFF,
  installationSchedulingAtCutoff: INSTALL_SCHEDULING_AT_CUTOFF,
} as const;
/** Training-schema range for distanceKm. */
export const DISTANCE_KM_RANGE = { min: 0, max: 2000 } as const;

export type MlFeatures = {
  inventoryAvailableAtCreation: boolean;
  deliveryZone: DeliveryZone;
  distanceKm: number;
  carrierId: CarrierId;
  dispatchStatusAtCutoff: (typeof DISPATCH_STATUSES_AT_CUTOFF)[number];
  hoursToPromisedAtCutoff: number;
  installationRequired: boolean;
  installationSlotAvailableAtCutoff: boolean | null;
  installationSchedulingAtCutoff: (typeof INSTALL_SCHEDULING_AT_CUTOFF)[number];
};

/** Where each feature value came from. */
export type FeatureSource = "order_record" | "synthetic_demo";
export const FEATURE_SOURCES: Record<keyof MlFeatures, FeatureSource> = {
  inventoryAvailableAtCreation: "synthetic_demo",
  deliveryZone: "synthetic_demo",
  distanceKm: "synthetic_demo",
  carrierId: "synthetic_demo",
  installationSlotAvailableAtCutoff: "synthetic_demo",
  dispatchStatusAtCutoff: "order_record",
  hoursToPromisedAtCutoff: "order_record",
  installationRequired: "order_record",
  installationSchedulingAtCutoff: "order_record",
};

export type MappingResult =
  | { ok: true; features: MlFeatures; usesSyntheticInputs: boolean }
  | { ok: false; reasons: string[] };

const inList = <T extends string>(v: unknown, list: readonly T[]): v is T =>
  typeof v === "string" && (list as readonly string[]).includes(v);

/** Maps an order to API features. Never fills missing or unknown values with defaults. */
export function mapOrderToFeatures(order: Order, now: Date = new Date()): MappingResult {
  const reasons: string[] = [];
  const ctx = order.mlContext;
  if (order.deliveryStatus === "delivered") reasons.push("The order is already delivered, so a pre-delivery prediction no longer applies.");
  if (order.installationStatus === "completed") reasons.push("Installation is already completed.");
  if (order.installationRequired && !inList(order.installationStatus, ["not_scheduled", "scheduled"] as const))
    reasons.push("Installation is required but its scheduling status is not a value the model was trained on.");
  if (!ctx) {
    reasons.push("Model inputs (inventory at creation, delivery zone, distance, carrier, installation slot availability) are not recorded for this order.");
  } else {
    if (ctx.provenance !== "synthetic_demo") reasons.push("Model inputs have an unknown origin.");
    if (typeof ctx.inventoryAvailableAtCreation !== "boolean") reasons.push("Inventory availability at order creation is not recorded.");
    if (ctx.deliveryZone == null) reasons.push("Delivery zone is not recorded.");
    else if (!inList(ctx.deliveryZone, DELIVERY_ZONES)) reasons.push(`Delivery zone "${ctx.deliveryZone}" is not one of the trained values (${DELIVERY_ZONES.join(", ")}).`);
    if (ctx.distanceKm == null) reasons.push("Delivery distance is not recorded.");
    else if (typeof ctx.distanceKm !== "number" || !Number.isFinite(ctx.distanceKm) || ctx.distanceKm < DISTANCE_KM_RANGE.min || ctx.distanceKm > DISTANCE_KM_RANGE.max)
      reasons.push(`Delivery distance must be between ${DISTANCE_KM_RANGE.min} and ${DISTANCE_KM_RANGE.max} km.`);
    if (ctx.carrierId == null) reasons.push("Carrier is not recorded.");
    else if (!inList(ctx.carrierId, CARRIER_IDS)) reasons.push(`Carrier "${ctx.carrierId}" is not one of the trained values (${CARRIER_IDS.join(", ")}).`);
    if (order.installationRequired && typeof ctx.installationSlotAvailableAtCutoff !== "boolean")
      reasons.push("Installation slot availability is not recorded.");
  }
  const hours = (Date.parse(`${order.expectedDelivery}T00:00:00Z`) - now.getTime()) / 3_600_000;
  if (!Number.isFinite(hours)) reasons.push("Expected delivery date is invalid.");
  else if (hours <= 0 && order.deliveryStatus !== "delivered") reasons.push("The expected delivery time has already passed.");
  if (reasons.length || !ctx) return { ok: false, reasons };

  return {
    ok: true,
    usesSyntheticInputs: true,
    features: {
      inventoryAvailableAtCreation: ctx.inventoryAvailableAtCreation as boolean,
      deliveryZone: ctx.deliveryZone as DeliveryZone,
      distanceKm: ctx.distanceKm as number,
      carrierId: ctx.carrierId as CarrierId,
      dispatchStatusAtCutoff: order.deliveryStatus === "processing" ? "not_dispatched" : "dispatched",
      hoursToPromisedAtCutoff: Math.round(hours * 10) / 10,
      installationRequired: order.installationRequired,
      installationSlotAvailableAtCutoff: order.installationRequired ? (ctx.installationSlotAvailableAtCutoff as boolean) : null,
      installationSchedulingAtCutoff: order.installationRequired
        ? (order.installationStatus as "not_scheduled" | "scheduled")
        : "not_required",
    },
  };
}

/** Re-checks a feature payload against the training vocabularies (used by the server relay too). */
export function validateFeaturePayload(f: unknown): string[] {
  const e: string[] = [];
  const x = f as Record<string, unknown> | null;
  if (!x || typeof x !== "object" || Array.isArray(x)) return ["features must be an object"];
  const allowed = new Set(Object.keys(FEATURE_SOURCES));
  for (const k of Object.keys(x)) if (!allowed.has(k)) e.push(`unexpected field ${k}`);
  for (const k of ["inventoryAvailableAtCreation", "installationRequired"]) if (typeof x[k] !== "boolean") e.push(`${k} must be boolean`);
  if (!inList(x["deliveryZone"], DELIVERY_ZONES)) e.push("deliveryZone not in training vocabulary");
  if (!inList(x["carrierId"], CARRIER_IDS)) e.push("carrierId not in training vocabulary");
  if (!inList(x["dispatchStatusAtCutoff"], DISPATCH_STATUSES_AT_CUTOFF)) e.push("dispatchStatusAtCutoff not in training vocabulary");
  if (!inList(x["installationSchedulingAtCutoff"], INSTALL_SCHEDULING_AT_CUTOFF)) e.push("installationSchedulingAtCutoff not in training vocabulary");
  const d = x["distanceKm"];
  if (typeof d !== "number" || !Number.isFinite(d) || d < DISTANCE_KM_RANGE.min || d > DISTANCE_KM_RANGE.max) e.push("distanceKm out of range");
  const h = x["hoursToPromisedAtCutoff"];
  if (typeof h !== "number" || !Number.isFinite(h) || h <= 0) e.push("hoursToPromisedAtCutoff must be a positive number");
  const s = x["installationSlotAvailableAtCutoff"];
  if (x["installationRequired"] === true && typeof s !== "boolean") e.push("installationSlotAvailableAtCutoff must be boolean when installation is required");
  if (x["installationRequired"] === false && (s !== null || x["installationSchedulingAtCutoff"] !== "not_required"))
    e.push("installation fields must be null/not_required when installation is not required");
  return e;
}

/** Installation predictions are only requested when installation is required. */
export function shouldPredictInstallation(f: Pick<MlFeatures, "installationRequired">): boolean {
  return f.installationRequired === true;
}

export type Prediction = {
  predictedLabel: string;
  modelScores: Record<string, number>;
  scoreNote: string | null;
  syntheticDataOnly: boolean;
};

export type MlErrorKind = "unavailable" | "http" | "invalid_response" | "timeout" | "invalid_input";
export class MlApiError extends Error {
  constructor(public kind: MlErrorKind, message: string, public status?: number) {
    super(message);
    this.name = "MlApiError";
  }
}

export function parsePrediction(body: unknown): Prediction {
  const b = body as { predicted_label?: unknown; model_scores?: unknown; score_note?: unknown; synthetic_data_only?: unknown } | null;
  if (!b || typeof b !== "object") throw new MlApiError("invalid_response", "Response is not an object.");
  if (typeof b.predicted_label !== "string" || !b.predicted_label) throw new MlApiError("invalid_response", "Missing predicted_label.");
  const s = b.model_scores;
  if (!s || typeof s !== "object" || Array.isArray(s)) throw new MlApiError("invalid_response", "Missing model_scores.");
  const entries = Object.entries(s as Record<string, unknown>);
  if (!entries.length || entries.some(([, v]) => typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1))
    throw new MlApiError("invalid_response", "model_scores must be numbers between 0 and 1.");
  return {
    predictedLabel: b.predicted_label,
    modelScores: Object.fromEntries(entries) as Record<string, number>,
    scoreNote: typeof b.score_note === "string" ? b.score_note : null,
    syntheticDataOnly: b.synthetic_data_only === true,
  };
}

type FetchLike = typeof fetch;
type Opts = { fetchImpl?: FetchLike; baseUrl?: string; timeoutMs?: number };

/**
 * Default transport: relays through the app server because the API sends no CORS headers.
 * Only the path and body are sent; the server decides the destination host.
 */
const proxyFetch: FetchLike = async (input, init) => {
  const url = new URL(String(input));
  const r = await mlProxy({ data: { path: url.pathname, body: typeof init?.body === "string" ? init.body : undefined } });
  if (!r.reachable) throw new TypeError("ML service unreachable");
  return new Response(r.text, { status: r.status });
};

async function request(path: string, init: RequestInit, o: Opts = {}): Promise<unknown> {
  const f = o.fetchImpl ?? proxyFetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 60_000);
  let res: Response;
  try {
    res = await f(`${o.baseUrl ?? getMlApiBaseUrl()}${path}`, { ...init, signal: ctrl.signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw new MlApiError("timeout", "The ML service did not respond in time. It may be waking up.");
    throw new MlApiError("unavailable", "The ML service could not be reached.");
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new MlApiError("http", `The ML service returned HTTP ${res.status}.`, res.status);
  try {
    return await res.json();
  } catch {
    throw new MlApiError("invalid_response", "The ML service returned a non-JSON response.");
  }
}

export async function checkHealth(o?: Opts): Promise<{ status: string; deliveryModelLoaded: boolean; installationModelLoaded: boolean }> {
  const b = (await request("/health", { method: "GET" }, o)) as { status?: unknown; delivery_model_loaded?: unknown; installation_model_loaded?: unknown } | null;
  if (!b || typeof b.status !== "string") throw new MlApiError("invalid_response", "Invalid health response.");
  return { status: b.status, deliveryModelLoaded: b.delivery_model_loaded === true, installationModelLoaded: b.installation_model_loaded === true };
}

async function predict(path: string, features: MlFeatures, o?: Opts) {
  const errs = validateFeaturePayload(features);
  if (errs.length) throw new MlApiError("invalid_input", `Prediction not sent: ${errs.join("; ")}.`);
  return request(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ features }) }, o).then(parsePrediction);
}
export const predictDelivery = (f: MlFeatures, o?: Opts) => predict("/predict/delivery", f, o);
export function predictInstallation(f: MlFeatures, o?: Opts) {
  if (!shouldPredictInstallation(f)) return Promise.reject(new Error("Installation prediction requested for an order without installation."));
  return predict("/predict/installation", f, o);
}
