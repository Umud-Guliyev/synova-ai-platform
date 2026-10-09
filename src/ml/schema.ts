/**
 * SYNOVA AI — ML-preparation dataset schema (Stage 7A).
 * Synthetic records only. Not used by the UI and not part of the browser bundle.
 */
export const DATASET_VERSION = "synova-synthetic-v1" as const;

export const DELIVERY_ZONES = ["urban", "suburban", "rural"] as const;
export const CARRIER_IDS = ["CARRIER-A", "CARRIER-B", "CARRIER-C"] as const;
export const DISPATCH_STATUSES_AT_CUTOFF = ["not_dispatched", "dispatched"] as const;
export const INSTALL_SCHEDULING_AT_CUTOFF = ["not_required", "not_scheduled", "scheduled"] as const;

export type DeliveryZone = (typeof DELIVERY_ZONES)[number];
export type CarrierId = (typeof CARRIER_IDS)[number];

/** Information known at the prediction cutoff. `null` = value missing / not recorded. */
export type PredictionFeatures = {
  inventoryAvailableAtCreation: boolean | null;
  deliveryZone: DeliveryZone | null;
  distanceKm: number | null;
  carrierId: CarrierId;
  dispatchStatusAtCutoff: (typeof DISPATCH_STATUSES_AT_CUTOFF)[number];
  /** Hours between the cutoff and the promised delivery time. */
  hoursToPromisedAtCutoff: number;
  installationRequired: boolean;
  /** null when installation is not required, or availability was not recorded. */
  installationSlotAvailableAtCutoff: boolean | null;
  installationSchedulingAtCutoff: (typeof INSTALL_SCHEDULING_AT_CUTOFF)[number];
};

/** Post-cutoff facts. NEVER usable as model input. `null` = not (yet) observed. */
export type Outcomes = {
  dispatchedAt: string | null;
  deliveredAt: string | null;
  installedAt: string | null;
};

export type DatasetRecord = {
  id: string;
  datasetVersion: typeof DATASET_VERSION;
  synthetic: true;
  createdAt: string;
  predictionCutoffAt: string;
  promisedDeliveryAt: string;
  features: PredictionFeatures;
  outcomes: Outcomes;
};

/** Explicit, configurable label definitions. */
export type DelayThresholds = {
  /** Delivery is delayed if deliveredAt > promisedDeliveryAt + this many hours. */
  deliveryGraceHours: number;
  /** Installation is delayed if installedAt > deliveredAt + this many hours. */
  installationWindowHours: number;
};
export const DEFAULT_THRESHOLDS: DelayThresholds = { deliveryGraceHours: 24, installationWindowHours: 72 };

/** Fields that carry outcome information and must never be model features. */
export const LEAKAGE_FIELDS = [
  "outcomes",
  "outcomes.dispatchedAt",
  "outcomes.deliveredAt",
  "outcomes.installedAt",
  "dispatchedAt",
  "deliveredAt",
  "installedAt",
  "deliveryDelayed",
  "installationDelayed",
] as const;

export const FEATURE_FIELDS = [
  "inventoryAvailableAtCreation",
  "deliveryZone",
  "distanceKm",
  "carrierId",
  "dispatchStatusAtCutoff",
  "hoursToPromisedAtCutoff",
  "installationRequired",
  "installationSlotAvailableAtCutoff",
  "installationSchedulingAtCutoff",
] as const satisfies readonly (keyof PredictionFeatures)[];

/** Returns only prediction-time features — the sole allowed model input. */
export function extractFeatures(r: DatasetRecord): PredictionFeatures {
  const out = {} as Record<string, unknown>;
  for (const k of FEATURE_FIELDS) out[k] = r.features[k];
  return out as PredictionFeatures;
}

const HOUR = 3_600_000;
const t = (iso: string | null) => (iso === null ? null : Date.parse(iso));
const isISO = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) && !Number.isNaN(Date.parse(v));
const oneOf = <T extends string>(v: unknown, list: readonly T[]) => typeof v === "string" && (list as readonly string[]).includes(v);

/** Validates structure, value ranges and timestamp consistency. Returns a list of error messages. */
export function validateRecord(input: unknown): string[] {
  const e: string[] = [];
  if (!input || typeof input !== "object") return ["record is not an object"];
  const r = input as DatasetRecord;
  if (typeof r.id !== "string" || !r.id) e.push("id missing");
  if (r.datasetVersion !== DATASET_VERSION) e.push("unsupported datasetVersion");
  if (r.synthetic !== true) e.push("record not marked synthetic");
  for (const k of ["createdAt", "predictionCutoffAt", "promisedDeliveryAt"] as const) {
    if (!isISO(r[k])) e.push(`${k} is not a valid ISO timestamp`);
  }
  const f = r.features;
  const o = r.outcomes;
  if (!f || typeof f !== "object") return [...e, "features missing"];
  if (!o || typeof o !== "object") return [...e, "outcomes missing"];
  for (const k of ["dispatchedAt", "deliveredAt", "installedAt"] as const) {
    if (o[k] !== null && !isISO(o[k])) e.push(`outcomes.${k} is not a valid ISO timestamp or null`);
  }
  if (e.length) return e;

  const created = t(r.createdAt)!, cutoff = t(r.predictionCutoffAt)!, promised = t(r.promisedDeliveryAt)!;
  const dispatched = t(o.dispatchedAt), delivered = t(o.deliveredAt), installed = t(o.installedAt);

  if (!(created <= cutoff)) e.push("predictionCutoffAt before createdAt");
  if (!(cutoff < promised)) e.push("predictionCutoffAt must be before promisedDeliveryAt");
  if (dispatched !== null && dispatched < created) e.push("dispatchedAt before createdAt");
  if (delivered !== null && dispatched === null) e.push("delivered without dispatch");
  if (delivered !== null && dispatched !== null && delivered < dispatched) e.push("deliveredAt before dispatchedAt");
  if (installed !== null && delivered === null) e.push("installed without delivery");
  if (installed !== null && delivered !== null && installed < delivered) e.push("installedAt before deliveredAt");

  if (f.inventoryAvailableAtCreation !== null && typeof f.inventoryAvailableAtCreation !== "boolean") e.push("inventoryAvailableAtCreation invalid");
  if (f.deliveryZone !== null && !oneOf(f.deliveryZone, DELIVERY_ZONES)) e.push("deliveryZone invalid");
  if (f.distanceKm !== null && !(typeof f.distanceKm === "number" && Number.isFinite(f.distanceKm) && f.distanceKm >= 0 && f.distanceKm <= 2000)) e.push("distanceKm out of range");
  if (!oneOf(f.carrierId, CARRIER_IDS)) e.push("carrierId invalid");
  if (!oneOf(f.dispatchStatusAtCutoff, DISPATCH_STATUSES_AT_CUTOFF)) e.push("dispatchStatusAtCutoff invalid");
  if (typeof f.installationRequired !== "boolean") e.push("installationRequired invalid");
  if (!oneOf(f.installationSchedulingAtCutoff, INSTALL_SCHEDULING_AT_CUTOFF)) e.push("installationSchedulingAtCutoff invalid");

  const expectedHours = (promised - cutoff) / HOUR;
  if (typeof f.hoursToPromisedAtCutoff !== "number" || Math.abs(f.hoursToPromisedAtCutoff - expectedHours) > 0.01) e.push("hoursToPromisedAtCutoff inconsistent with timestamps");

  // Prediction-time status must agree with recorded dispatch time.
  const dispatchedByCutoff = dispatched !== null && dispatched <= cutoff;
  if ((f.dispatchStatusAtCutoff === "dispatched") !== dispatchedByCutoff) e.push("dispatchStatusAtCutoff contradicts dispatchedAt");

  if (!f.installationRequired) {
    if (f.installationSchedulingAtCutoff !== "not_required") e.push("installation not required but scheduling status set");
    if (f.installationSlotAvailableAtCutoff !== null) e.push("installation not required but slot availability set");
    if (o.installedAt !== null) e.push("installation not required but installedAt set");
  } else if (f.installationSchedulingAtCutoff === "not_required") {
    e.push("installation required but scheduling status is not_required");
  }
  return e;
}
