import { DEFAULT_THRESHOLDS, type DatasetRecord, type DelayThresholds } from "./schema";

/**
 * Target label. `null` = UNKNOWN (outcome not observed) — never treat as "not delayed".
 * "not_applicable" = the task does not apply (e.g. no installation required).
 */
export type Label = true | false | null | "not_applicable";
export type Labels = { deliveryDelayed: Label; installationDelayed: Label };

const HOUR = 3_600_000;

export function validateThresholds(t: DelayThresholds): string[] {
  const e: string[] = [];
  if (!Number.isFinite(t.deliveryGraceHours) || t.deliveryGraceHours < 0) e.push("deliveryGraceHours must be ≥ 0");
  if (!Number.isFinite(t.installationWindowHours) || t.installationWindowHours <= 0) e.push("installationWindowHours must be > 0");
  return e;
}

export function computeLabels(r: DatasetRecord, thresholds: DelayThresholds = DEFAULT_THRESHOLDS): Labels {
  const errs = validateThresholds(thresholds);
  if (errs.length) throw new Error(`Invalid thresholds: ${errs.join("; ")}`);
  const promised = Date.parse(r.promisedDeliveryAt);
  const delivered = r.outcomes.deliveredAt === null ? null : Date.parse(r.outcomes.deliveredAt);
  const installed = r.outcomes.installedAt === null ? null : Date.parse(r.outcomes.installedAt);

  const deliveryDelayed: Label = delivered === null ? null : delivered > promised + thresholds.deliveryGraceHours * HOUR;

  let installationDelayed: Label;
  if (!r.features.installationRequired) installationDelayed = "not_applicable";
  else if (delivered === null || installed === null) installationDelayed = null;
  else installationDelayed = installed > delivered + thresholds.installationWindowHours * HOUR;

  return { deliveryDelayed, installationDelayed };
}
