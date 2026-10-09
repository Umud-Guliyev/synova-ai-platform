import { CARRIER_IDS, DATASET_VERSION, DELIVERY_ZONES, type DatasetRecord, type DeliveryZone } from "./schema";

export type GeneratorConfig = {
  seed: number;
  count: number;
  /** Earliest order creation time (ISO). Orders are spread over `spanDays`. */
  startAt: string;
  spanDays: number;
  /** Hours after creation at which features are frozen. */
  cutoffHoursAfterCreation: number;
  /** Share of records whose outcomes are not yet observed (0–1). */
  unknownOutcomeRate: number;
  /** Share of feature values recorded as missing (0–1). */
  missingFeatureRate: number;
};

export const DEFAULT_CONFIG: GeneratorConfig = {
  seed: 42,
  count: 500,
  startAt: "2026-01-01T00:00:00.000Z",
  spanDays: 180,
  cutoffHoursAfterCreation: 24,
  unknownOutcomeRate: 0.08,
  missingFeatureRate: 0.05,
};

export function validateConfig(c: GeneratorConfig): string[] {
  const e: string[] = [];
  if (!Number.isInteger(c.seed)) e.push("seed must be an integer");
  if (!Number.isInteger(c.count) || c.count < 0 || c.count > 1_000_000) e.push("count must be an integer between 0 and 1,000,000");
  if (Number.isNaN(Date.parse(c.startAt))) e.push("startAt must be a valid ISO timestamp");
  if (!(c.spanDays > 0)) e.push("spanDays must be > 0");
  if (!(c.cutoffHoursAfterCreation >= 0 && c.cutoffHoursAfterCreation < 48)) e.push("cutoffHoursAfterCreation must be in [0, 48)");
  for (const k of ["unknownOutcomeRate", "missingFeatureRate"] as const) {
    if (!(c[k] >= 0 && c[k] <= 1)) e.push(`${k} must be between 0 and 1`);
  }
  return e;
}

/** Mulberry32: small deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();
const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function generateDataset(config: Partial<GeneratorConfig> = {}): DatasetRecord[] {
  const c = { ...DEFAULT_CONFIG, ...config };
  const errs = validateConfig(c);
  if (errs.length) throw new Error(`Invalid generator config: ${errs.join("; ")}`);
  const r = rng(c.seed);
  const pick = <T,>(list: readonly T[]) => list[Math.floor(r() * list.length)]!;
  const maybe = <T,>(v: T): T | null => (r() < c.missingFeatureRate ? null : v);
  const start = Date.parse(c.startAt);
  const records: DatasetRecord[] = [];

  for (let i = 0; i < c.count; i++) {
    const created = start + Math.floor(r() * c.spanDays * 24) * HOUR;
    const cutoff = created + c.cutoffHoursAfterCreation * HOUR;
    const leadDays = 2 + Math.floor(r() * 9); // 2–10 days
    const promised = created + leadDays * 24 * HOUR;

    const zone: DeliveryZone = pick(DELIVERY_ZONES);
    const distance = Math.round((zone === "urban" ? 2 + r() * 20 : zone === "suburban" ? 15 + r() * 50 : 50 + r() * 250) * 10) / 10;
    const carrier = pick(CARRIER_IDS);
    const inventory = r() < 0.85;
    const installationRequired = r() < 0.55;
    const slotAvailable = installationRequired ? r() < 0.7 : null;

    // Dispatch: inventory shortfalls slow dispatch; noise prevents single-feature determinism.
    const dispatchDelayH = Math.max(1, (inventory ? 6 + r() * 30 : 30 + r() * 90) + (r() - 0.5) * 12);
    const dispatched = created + dispatchDelayH * HOUR;

    // Transit: distance, zone and carrier contribute, plus random disruption.
    const carrierFactor = carrier === "CARRIER-C" ? 1.35 : carrier === "CARRIER-B" ? 1.1 : 1;
    const disruption = r() < 0.1 ? 24 + r() * 72 : 0;
    const transitH = (8 + distance * 0.35) * carrierFactor * (0.7 + r() * 0.8) + disruption;
    const delivered = dispatched + transitH * HOUR;

    // Installation: driven by slot availability and scheduling, independent of transit noise.
    let schedulingAtCutoff: DatasetRecord["features"]["installationSchedulingAtCutoff"] = "not_required";
    let installed: number | null = null;
    if (installationRequired) {
      const scheduledEarly = r() < (slotAvailable ? 0.6 : 0.2);
      schedulingAtCutoff = scheduledEarly ? "scheduled" : "not_scheduled";
      const z = -1.2 + (slotAvailable ? 0 : 1.6) + (scheduledEarly ? -0.9 : 0.6) + (r() - 0.5) * 2;
      const installDelayH = r() < sigmoid(z) ? 72 + r() * 168 : 4 + r() * 60;
      installed = delivered + installDelayH * HOUR;
    }

    // Some outcomes not yet observed (unknown, not negative).
    const unknown = r() < c.unknownOutcomeRate;
    const unknownStage = r();
    const outcomes = {
      dispatchedAt: unknown && unknownStage < 0.3 && dispatched > cutoff ? null : iso(dispatched),
      deliveredAt: unknown && unknownStage < 0.7 ? null : iso(delivered),
      installedAt: installed === null || unknown ? null : iso(installed),
    };
    if (outcomes.dispatchedAt === null) outcomes.deliveredAt = null;
    if (outcomes.deliveredAt === null) outcomes.installedAt = null;

    const dispatchedByCutoff = outcomes.dispatchedAt !== null && dispatched <= cutoff;
    records.push({
      id: `SYN-${c.seed}-${String(i + 1).padStart(6, "0")}`,
      datasetVersion: DATASET_VERSION,
      synthetic: true,
      createdAt: iso(created),
      predictionCutoffAt: iso(cutoff),
      promisedDeliveryAt: iso(promised),
      features: {
        inventoryAvailableAtCreation: maybe(inventory),
        deliveryZone: maybe(zone),
        distanceKm: maybe(distance),
        carrierId: carrier,
        dispatchStatusAtCutoff: dispatchedByCutoff ? "dispatched" : "not_dispatched",
        hoursToPromisedAtCutoff: (promised - cutoff) / HOUR,
        installationRequired,
        installationSlotAvailableAtCutoff: slotAvailable === null ? null : maybe(slotAvailable),
        installationSchedulingAtCutoff: schedulingAtCutoff,
      },
      outcomes,
    });
  }
  return records;
}
