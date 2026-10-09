import { describe, expect, it } from "vitest";
import { generateDataset, DEFAULT_CONFIG } from "@/ml/generator";
import { computeLabels } from "@/ml/labels";
import { summarizeDataset, findLeakage } from "@/ml/quality";
import { FEATURE_FIELDS, extractFeatures, validateRecord, type DatasetRecord } from "@/ml/schema";

const data = generateDataset({ seed: 7, count: 2000 });
const clone = (r: DatasetRecord): DatasetRecord => JSON.parse(JSON.stringify(r));
const firstComplete = data.find((r) => r.outcomes.deliveredAt && r.features.installationRequired && r.outcomes.installedAt)!;

describe("validation", () => {
  it("all generated records are valid and synthetic", () => {
    expect(data.every((r) => validateRecord(r).length === 0 && r.synthetic)).toBe(true);
  });
  it("rejects invalid dates, impossible values and contradictions", () => {
    const a = clone(firstComplete); a.createdAt = "not-a-date";
    const b = clone(firstComplete); b.features.distanceKm = -5;
    const c = clone(firstComplete); c.outcomes.deliveredAt = "2000-01-01T00:00:00.000Z";
    const d = clone(firstComplete); d.features.installationRequired = false;
    const e = clone(firstComplete); e.features.dispatchStatusAtCutoff = e.features.dispatchStatusAtCutoff === "dispatched" ? "not_dispatched" : "dispatched";
    for (const r of [a, b, c, d, e]) expect(validateRecord(r).length).toBeGreaterThan(0);
    expect(validateRecord(null)).toEqual(["record is not an object"]);
  });
});

describe("reproducibility", () => {
  it("same seed and config produce identical records", () => {
    expect(generateDataset({ seed: 7, count: 2000 })).toEqual(data);
  });
  it("different seeds produce different records", () => {
    expect(generateDataset({ seed: 8, count: 50 })).not.toEqual(generateDataset({ seed: 7, count: 50 }));
  });
});

describe("timestamps", () => {
  it("are ordered created ≤ cutoff < promised and dispatch ≤ delivery ≤ install", () => {
    for (const r of data) {
      const ts = [r.outcomes.dispatchedAt, r.outcomes.deliveredAt, r.outcomes.installedAt].filter(Boolean).map((x) => Date.parse(x!));
      expect([...ts].sort((x, y) => x - y)).toEqual(ts);
      expect(Date.parse(r.createdAt) <= Date.parse(r.predictionCutoffAt)).toBe(true);
      expect(Date.parse(r.predictionCutoffAt) < Date.parse(r.promisedDeliveryAt)).toBe(true);
    }
  });
});

describe("targets", () => {
  const labels = data.map((r) => computeLabels(r));
  it("delivery and installation outcomes vary independently", () => {
    const combos = new Set(labels.filter((l) => typeof l.installationDelayed === "boolean" && l.deliveryDelayed !== null).map((l) => `${l.deliveryDelayed}-${l.installationDelayed}`));
    expect(combos).toEqual(new Set(["true-true", "true-false", "false-true", "false-false"]));
  });
  it("both classes exist for each task (not trivially one-sided)", () => {
    const s = summarizeDataset(data);
    expect(s.delivery.delayed).toBeGreaterThan(0);
    expect(s.delivery.notDelayed).toBeGreaterThan(0);
    expect(s.installation.delayed).toBeGreaterThan(0);
    expect(s.installation.notDelayed).toBeGreaterThan(0);
  });
  it("no single feature value perfectly determines delivery delay", () => {
    for (const k of ["deliveryZone", "carrierId", "inventoryAvailableAtCreation", "dispatchStatusAtCutoff"] as const) {
      const groups = new Map<string, Set<unknown>>();
      data.forEach((r, i) => {
        const l = labels[i]!.deliveryDelayed;
        if (typeof l !== "boolean") return;
        const key = String(r.features[k]);
        groups.set(key, (groups.get(key) ?? new Set()).add(l));
      });
      expect([...groups.values()].some((g) => g.size === 2)).toBe(true);
    }
  });
  it("unknown outcomes are null, not 'not delayed'", () => {
    const r = clone(firstComplete); r.outcomes.deliveredAt = null; r.outcomes.installedAt = null;
    expect(computeLabels(r)).toEqual({ deliveryDelayed: null, installationDelayed: null });
  });
  it("installation not required is not_applicable", () => {
    const r = data.find((x) => !x.features.installationRequired && x.outcomes.deliveredAt)!;
    expect(computeLabels(r).installationDelayed).toBe("not_applicable");
  });
  it("thresholds are configurable and validated", () => {
    const r = clone(firstComplete);
    r.outcomes.deliveredAt = new Date(Date.parse(r.promisedDeliveryAt) + 10 * 3_600_000).toISOString();
    r.outcomes.installedAt = r.outcomes.deliveredAt;
    expect(computeLabels(r, { deliveryGraceHours: 24, installationWindowHours: 72 }).deliveryDelayed).toBe(false);
    expect(computeLabels(r, { deliveryGraceHours: 0, installationWindowHours: 72 }).deliveryDelayed).toBe(true);
    expect(() => computeLabels(r, { deliveryGraceHours: -1, installationWindowHours: 72 })).toThrow();
  });
});

describe("leakage prevention", () => {
  it("extracted features contain only prediction-time fields", () => {
    const f = extractFeatures(firstComplete);
    expect(Object.keys(f).sort()).toEqual([...FEATURE_FIELDS].sort());
    expect(findLeakage(Object.keys(f))).toEqual([]);
  });
  it("flags outcome and label fields", () => {
    expect(findLeakage(["distanceKm", "outcomes.deliveredAt", "deliveryDelayed", "installedAt"])).toEqual(["outcomes.deliveredAt", "deliveryDelayed", "installedAt"]);
  });
});

describe("dataset summary", () => {
  it("counts totals, duplicates, invalid, missing and exclusions", () => {
    const sample = generateDataset({ seed: 3, count: 200 });
    const bad = clone(sample[0]!); bad.id = "BAD"; bad.synthetic = false as true;
    const s = summarizeDataset([...sample, clone(sample[1]!), bad]);
    expect(s.total).toBe(202);
    expect(s.duplicateIds).toEqual([sample[1]!.id]);
    expect(s.invalid.map((x) => x.id)).toEqual(["BAD"]);
    const d = s.delivery;
    expect(d.delayed + d.notDelayed + d.unknown + d.notApplicable).toBe(201);
    expect(s.excluded.delivery).toBe(d.unknown);
    expect(s.excluded.installation).toBe(s.installation.unknown + s.installation.notApplicable);
    expect(s.missingByField["features.deliveryZone"]).toBe(sample.filter((r) => r.features.deliveryZone === null).length + (sample[1]!.features.deliveryZone === null ? 1 : 0));
  });
  it("handles an empty dataset", () => {
    expect(summarizeDataset([])).toMatchObject({ total: 0, duplicateIds: [], invalid: [], excluded: { delivery: 0, installation: 0 } });
  });
});

describe("configuration", () => {
  it("rejects invalid configuration", () => {
    expect(() => generateDataset({ count: -1 })).toThrow();
    expect(() => generateDataset({ seed: 1.5 })).toThrow();
    expect(() => generateDataset({ unknownOutcomeRate: 2 })).toThrow();
    expect(() => generateDataset({ startAt: "nope" })).toThrow();
  });
  it("supports zero records and default config", () => {
    expect(generateDataset({ count: 0 })).toEqual([]);
    expect(generateDataset({ count: 5 })).toHaveLength(5);
    expect(DEFAULT_CONFIG.seed).toBe(42);
  });
});
