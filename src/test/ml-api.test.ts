import { describe, expect, it, vi } from "vitest";
import type { Order } from "@/data/demo-orders";
import { MlApiError, mapOrderToFeatures, parsePrediction, predictDelivery, predictInstallation, shouldPredictInstallation, type MlFeatures } from "@/lib/ml-api";

const NOW = new Date("2026-10-09T12:00:00Z");
const ctx = { provenance: "synthetic_demo" as const, inventoryAvailableAtCreation: true, deliveryZone: "urban", distanceKm: 18, carrierId: "CARRIER-A", installationSlotAvailableAtCutoff: true };
const base: Order = {
  id: "T-1", product: "Test", expectedDelivery: "2026-10-11", deliveryStatus: "processing", deliveredOn: null,
  stockConfirmed: true, installationRequired: true, installationStatus: "scheduled", installationDate: null, mlContext: ctx,
};
const ok = { predicted_label: "not_delayed", model_scores: { delayed: 0.28, not_delayed: 0.72 }, score_note: "n", synthetic_data_only: true };
const res = (body: unknown, status = 200) => vi.fn(async () => new Response(JSON.stringify(body), { status }));

describe("feature mapping", () => {
  it("maps order fields to exact API features", () => {
    const r = mapOrderToFeatures(base, NOW);
    expect(r).toEqual({ ok: true, usesSyntheticInputs: true, features: {
      inventoryAvailableAtCreation: true, deliveryZone: "urban", distanceKm: 18, carrierId: "CARRIER-A",
      dispatchStatusAtCutoff: "not_dispatched", hoursToPromisedAtCutoff: 36, installationRequired: true,
      installationSlotAvailableAtCutoff: true, installationSchedulingAtCutoff: "scheduled",
    } });
  });
  it("refuses when model inputs are missing instead of defaulting", () => {
    const r = (() => { const { mlContext: _omit, ...rest } = base; return mapOrderToFeatures(rest, NOW); })();
    expect(r.ok).toBe(false);
    const r2 = mapOrderToFeatures({ ...base, mlContext: { ...ctx, distanceKm: null } }, NOW);
    expect(r2.ok).toBe(false);
  });
  it("refuses for delivered orders", () => {
    expect(mapOrderToFeatures({ ...base, deliveryStatus: "delivered", deliveredOn: "2026-10-08" }, NOW).ok).toBe(false);
  });
  it("uses not_required and null slot when no installation", () => {
    const r = mapOrderToFeatures({ ...base, installationRequired: false, installationStatus: "not_required", mlContext: { ...ctx, installationSlotAvailableAtCutoff: null } }, NOW);
    expect(r.ok && r.features.installationSchedulingAtCutoff).toBe("not_required");
    expect(r.ok && r.features.installationSlotAvailableAtCutoff).toBeNull();
  });
});

describe("response validation", () => {
  it("accepts a valid response", () => {
    expect(parsePrediction(ok).modelScores).toEqual({ delayed: 0.28, not_delayed: 0.72 });
  });
  it("rejects missing label or bad scores", () => {
    expect(() => parsePrediction({ model_scores: { a: 1 } })).toThrow(MlApiError);
    expect(() => parsePrediction({ predicted_label: "x", model_scores: { a: "1" } })).toThrow(MlApiError);
    expect(() => parsePrediction({ predicted_label: "x", model_scores: { a: 2 } })).toThrow(MlApiError);
  });
});

describe("error handling", () => {
  const f = (mapOrderToFeatures(base, NOW) as { features: MlFeatures }).features;
  it("reports HTTP errors", async () => {
    await expect(predictDelivery(f, { fetchImpl: res({}, 503) })).rejects.toMatchObject({ kind: "http", status: 503 });
  });
  it("reports an unreachable service", async () => {
    const fetchImpl = vi.fn(async () => { throw new TypeError("network"); });
    await expect(predictDelivery(f, { fetchImpl })).rejects.toMatchObject({ kind: "unavailable" });
  });
  it("reports invalid responses", async () => {
    await expect(predictDelivery(f, { fetchImpl: res({ nope: 1 }) })).rejects.toMatchObject({ kind: "invalid_response" });
  });
});

describe("installation-required condition", () => {
  it("only predicts installation when required", async () => {
    expect(shouldPredictInstallation({ installationRequired: false })).toBe(false);
    const fetchImpl = res(ok);
    const f = (mapOrderToFeatures(base, NOW) as { features: MlFeatures }).features;
    await expect(predictInstallation({ ...f, installationRequired: false }, { fetchImpl })).rejects.toThrow();
    expect(fetchImpl).not.toHaveBeenCalled();
    await predictInstallation(f, { fetchImpl, baseUrl: "https://x" });
    expect(fetchImpl).toHaveBeenCalledWith("https://x/predict/installation", expect.objectContaining({ method: "POST" }));
  });
});

describe("training-schema alignment", () => {
  it("uses the exact categorical vocabularies from the training schema", async () => {
    const { ML_CATEGORIES } = await import("@/lib/ml-api");
    expect(ML_CATEGORIES.deliveryZone).toEqual(["urban", "suburban", "rural"]);
    expect(ML_CATEGORIES.carrierId).toEqual(["CARRIER-A", "CARRIER-B", "CARRIER-C"]);
    expect(ML_CATEGORIES.dispatchStatusAtCutoff).toEqual(["not_dispatched", "dispatched"]);
    expect(ML_CATEGORIES.installationSchedulingAtCutoff).toEqual(["not_required", "not_scheduled", "scheduled"]);
  });
  it("refuses categories the model was not trained on (API would silently ignore them)", () => {
    expect(mapOrderToFeatures({ ...base, mlContext: { ...ctx, deliveryZone: "Baku" } }, NOW).ok).toBe(false);
    expect(mapOrderToFeatures({ ...base, mlContext: { ...ctx, carrierId: "carrier_1" } }, NOW).ok).toBe(false);
  });
  it("refuses out-of-range distance and missing installation slot", () => {
    expect(mapOrderToFeatures({ ...base, mlContext: { ...ctx, distanceKm: 5000 } }, NOW).ok).toBe(false);
    expect(mapOrderToFeatures({ ...base, mlContext: { ...ctx, installationSlotAvailableAtCutoff: null } }, NOW).ok).toBe(false);
  });
  it("maps dispatched orders to 'dispatched'", () => {
    const r = mapOrderToFeatures({ ...base, deliveryStatus: "dispatched" }, NOW);
    expect(r.ok && r.features.dispatchStatusAtCutoff).toBe("dispatched");
  });
  it("does not send invalid payloads to the API", async () => {
    const fetchImpl = res(ok);
    const f = (mapOrderToFeatures(base, NOW) as { features: MlFeatures }).features;
    await expect(predictDelivery({ ...f, deliveryZone: "Baku" as never }, { fetchImpl })).rejects.toMatchObject({ kind: "invalid_input" });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("synthetic-data disclosure", () => {
  it("every demo order with ML inputs is marked synthetic_demo and uses trained vocabularies", async () => {
    const { getDemoOrders } = await import("@/data/demo-orders");
    const { ML_CATEGORIES } = await import("@/lib/ml-api");
    const withCtx = getDemoOrders(NOW).filter((o) => o.mlContext);
    expect(withCtx.map((o) => o.id)).toEqual(["DEMO-1001", "DEMO-1003", "DEMO-1006", "DEMO-1008", "DEMO-1012", "DEMO-1014"]);
    for (const o of withCtx) {
      expect(o.mlContext!.provenance).toBe("synthetic_demo");
      expect(ML_CATEGORIES.deliveryZone).toContain(o.mlContext!.deliveryZone);
      expect(ML_CATEGORIES.carrierId).toContain(o.mlContext!.carrierId);
    }
  });
  it("labels invented inputs as synthetic and derived ones as from the order record", async () => {
    const { FEATURE_SOURCES } = await import("@/lib/ml-api");
    expect(FEATURE_SOURCES.deliveryZone).toBe("synthetic_demo");
    expect(FEATURE_SOURCES.carrierId).toBe("synthetic_demo");
    expect(FEATURE_SOURCES.distanceKm).toBe("synthetic_demo");
    expect(FEATURE_SOURCES.inventoryAvailableAtCreation).toBe("synthetic_demo");
    expect(FEATURE_SOURCES.dispatchStatusAtCutoff).toBe("order_record");
    expect(FEATURE_SOURCES.installationSchedulingAtCutoff).toBe("order_record");
  });
});

describe("deployed model metadata alignment", () => {
  it("sends exactly the nine feature columns both models were trained on", async () => {
    const { FEATURE_SOURCES } = await import("@/lib/ml-api");
    const { FEATURE_FIELDS } = await import("@/ml/schema");
    const deployed = ["inventoryAvailableAtCreation", "deliveryZone", "distanceKm", "carrierId", "dispatchStatusAtCutoff",
      "hoursToPromisedAtCutoff", "installationRequired", "installationSlotAvailableAtCutoff", "installationSchedulingAtCutoff"];
    expect(Object.keys(FEATURE_SOURCES).sort()).toEqual([...deployed].sort());
    expect([...FEATURE_FIELDS].sort()).toEqual([...deployed].sort());
    const r = mapOrderToFeatures(base, NOW);
    expect(r.ok && Object.keys(r.features).sort()).toEqual([...deployed].sort());
  });
  it("uses the same label thresholds as the model metadata (24h delivery, 72h installation)", async () => {
    const { DEFAULT_THRESHOLDS } = await import("@/ml/schema");
    expect(DEFAULT_THRESHOLDS).toEqual({ deliveryGraceHours: 24, installationWindowHours: 72 });
  });
});
