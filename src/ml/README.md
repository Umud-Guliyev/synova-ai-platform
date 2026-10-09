# SYNOVA AI — ML dataset preparation (Stage 7A)

Synthetic, reproducible dataset foundation for future delivery-delay and installation-delay models.
**No model is trained or deployed. No accuracy is claimed.** All records are synthetic (`synthetic: true`,
IDs `SYN-<seed>-NNNNNN`, carriers `CARRIER-A/B/C`). Nothing here is imported by the UI, and the 16-order UI
demo dataset (`src/data/demo-orders.ts`) is untouched.

## Files
| File | Purpose |
|---|---|
| `schema.ts` | Record types, version, feature/leakage field lists, `extractFeatures`, `validateRecord` |
| `labels.ts` | Target definitions and thresholds, `computeLabels` |
| `generator.ts` | Deterministic seeded generator, `generateDataset`, `validateConfig` |
| `quality.ts` | `summarizeDataset` report and `findLeakage` |

## Schema (`synova-synthetic-v1`)
- `createdAt`, `predictionCutoffAt`, `promisedDeliveryAt`: ISO timestamps; `created ≤ cutoff < promised`.
- `features`: **only** information known at the cutoff: inventory at creation, delivery zone, distance (km),
  carrier, dispatch status at cutoff, hours to promise, installation required, slot availability, scheduling
  status at cutoff. `null` = value not recorded.
- `outcomes`: `dispatchedAt`, `deliveredAt`, `installedAt`. Recorded after the cutoff; `null` = not yet observed.

## Feature cutoff and leakage
Models may use `extractFeatures(record)` only. `outcomes.*`, final timestamps and labels are in
`LEAKAGE_FIELDS`; `findLeakage(names)` flags them. The separate `features` / `outcomes` objects
keep the two structurally apart.

## Targets (separate tasks)
Thresholds are configurable (`DelayThresholds`, defaults in `DEFAULT_THRESHOLDS`):
- **Delivery delayed**: `deliveredAt > promisedDeliveryAt + deliveryGraceHours` (default 24 h).
- **Installation delayed**: `installedAt > deliveredAt + installationWindowHours` (default 72 h).

Label values: `true` / `false` / `null` (**unknown**: outcome not observed, never treated as "not delayed") /
`"not_applicable"` (no installation required). Unknown and not-applicable records are counted in
`report.excluded` for that task.

## Generator config
`seed`, `count`, `startAt`, `spanDays`, `cutoffHoursAfterCreation` (0–48), `unknownOutcomeRate`,
`missingFeatureRate`. The same seed and config give identical records. Delivery outcomes depend on
inventory, distance, zone, carrier and random disruption. Installation outcomes depend on slot
availability, scheduling and their own noise, so the two targets vary independently.

## Usage
```ts
import { generateDataset } from "@/ml/generator";
import { summarizeDataset } from "@/ml/quality";
const records = generateDataset({ seed: 7, count: 1000 });
console.log(summarizeDataset(records));
```
CLI: `bun scripts/generate-ml-dataset.ts --seed 7 --count 1000 > /tmp/dataset.json` (report on stderr).

## Limitations
- Distributions are illustrative assumptions, not fitted to real operations.
- No order lines, multi-parcel shipments, cancellations or rescheduling history.
- Holidays and capacity limits are not modelled.
- Not suitable for estimating real-world model performance.
