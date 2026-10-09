import { computeLabels, type Label } from "./labels";
import { DEFAULT_THRESHOLDS, LEAKAGE_FIELDS, validateRecord, type DatasetRecord, type DelayThresholds } from "./schema";

export type ClassDistribution = { delayed: number; notDelayed: number; unknown: number; notApplicable: number };

export type DatasetReport = {
  total: number;
  duplicateIds: string[];
  missingByField: Record<string, number>;
  delivery: ClassDistribution;
  installation: ClassDistribution;
  invalid: { id: string; errors: string[] }[];
  /** Records unusable for training a task because its label is unknown or not applicable. */
  excluded: { delivery: number; installation: number };
};

function tally(d: ClassDistribution, l: Label) {
  if (l === true) d.delayed++;
  else if (l === false) d.notDelayed++;
  else if (l === null) d.unknown++;
  else d.notApplicable++;
}

export function summarizeDataset(records: DatasetRecord[], thresholds: DelayThresholds = DEFAULT_THRESHOLDS): DatasetReport {
  const seen = new Set<string>();
  const dup = new Set<string>();
  const missing: Record<string, number> = {};
  const delivery: ClassDistribution = { delayed: 0, notDelayed: 0, unknown: 0, notApplicable: 0 };
  const installation: ClassDistribution = { delayed: 0, notDelayed: 0, unknown: 0, notApplicable: 0 };
  const invalid: DatasetReport["invalid"] = [];

  for (const r of records) {
    if (seen.has(r.id)) dup.add(r.id);
    seen.add(r.id);
    const errors = validateRecord(r);
    if (errors.length) {
      invalid.push({ id: r.id ?? "(no id)", errors });
      continue;
    }
    for (const [k, v] of Object.entries(r.features)) {
      // Slot availability is null by design (not missing) when installation is not required.
      if (k === "installationSlotAvailableAtCutoff" && !r.features.installationRequired) continue;
      if (v === null) missing[`features.${k}`] = (missing[`features.${k}`] ?? 0) + 1;
    }
    for (const [k, v] of Object.entries(r.outcomes)) {
      if (k === "installedAt" && !r.features.installationRequired) continue; if (v === null) missing[`outcomes.${k}`] = (missing[`outcomes.${k}`] ?? 0) + 1;
    }
    const l = computeLabels(r, thresholds);
    tally(delivery, l.deliveryDelayed);
    tally(installation, l.installationDelayed);
  }

  return {
    total: records.length,
    duplicateIds: [...dup],
    missingByField: missing,
    delivery,
    installation,
    invalid,
    excluded: {
      delivery: delivery.unknown + delivery.notApplicable,
      installation: installation.unknown + installation.notApplicable,
    },
  };
}

/** Returns any proposed feature names that would leak outcome information. */
export function findLeakage(featureNames: readonly string[]): string[] {
  const banned = new Set<string>(LEAKAGE_FIELDS);
  return featureNames.filter((n) => banned.has(n) || n.startsWith("outcomes."));
}
