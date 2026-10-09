/**
 * Illustrative synthetic demo data. No real customers, retailers or orders.
 * Dates are expressed as day offsets relative to "today" so scenarios stay realistic.
 */
export type DeliveryStatus = "processing" | "dispatched" | "delivered";
export type InstallationStatus = "not_required" | "not_scheduled" | "scheduled" | "completed";

export type Order = {
  id: string;
  product: string;
  expectedDelivery: string; // ISO date (yyyy-mm-dd)
  deliveryStatus: DeliveryStatus;
  deliveredOn: string | null;
  stockConfirmed: boolean;
  installationRequired: boolean;
  installationStatus: InstallationStatus;
  installationDate: string | null;
  /**
   * Optional ML model inputs. NOT real order attributes: these are illustrative,
   * invented demo values (provenance "synthetic_demo"). Absent = not recorded; never defaulted.
   */
  mlContext?: MlContext;
};

export type MlContext = {
  /** Always "synthetic_demo": invented for the ML demo, not an operational fact. */
  provenance: "synthetic_demo";
  inventoryAvailableAtCreation: boolean | null;
  deliveryZone: string | null;
  distanceKm: number | null;
  carrierId: string | null;
  installationSlotAvailableAtCutoff: boolean | null;
};

import type { RiskFactorCode } from "@/lib/risk";

export type InterventionStatus = "open" | "in_progress" | "completed";
export type Intervention = {
  id: string;
  orderId: string;
  action: string;
  status: InterventionStatus;
  /** Risk rule this intervention addresses, when known. */
  factorCode?: RiskFactorCode;
  /** "seed" = shipped demo record; "demo_ui" = created in this browser session. */
  origin?: "seed" | "demo_ui";
};

type Seed = Omit<Order, "expectedDelivery" | "deliveredOn" | "installationDate"> & {
  deliveryOffset: number;
  deliveredOffset?: number;
  installationOffset?: number;
};

const seeds: Seed[] = [
  { id: "DEMO-1001", product: "French-door refrigerator", deliveryOffset: 1, deliveryStatus: "processing", stockConfirmed: true, installationRequired: true, installationStatus: "not_scheduled", mlContext: { provenance: "synthetic_demo", inventoryAvailableAtCreation: true, deliveryZone: "urban", distanceKm: 18, carrierId: "CARRIER-A", installationSlotAvailableAtCutoff: false } },
  { id: "DEMO-1002", product: "Front-load washing machine", deliveryOffset: -4, deliveredOffset: -4, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: true, installationStatus: "not_scheduled" },
  { id: "DEMO-1003", product: '65" OLED television', deliveryOffset: 6, deliveryStatus: "processing", stockConfirmed: true, installationRequired: false, installationStatus: "not_required", mlContext: { provenance: "synthetic_demo", inventoryAvailableAtCreation: true, deliveryZone: "suburban", distanceKm: 42, carrierId: "CARRIER-B", installationSlotAvailableAtCutoff: null } },
  { id: "DEMO-1004", product: "Built-in dishwasher", deliveryOffset: -2, deliveredOffset: -2, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: true, installationStatus: "scheduled", installationOffset: 2 },
  { id: "DEMO-1005", product: "Side-by-side refrigerator", deliveryOffset: -6, deliveredOffset: -6, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: true, installationStatus: "completed", installationOffset: -5 },
  { id: "DEMO-1006", product: "Tumble dryer", deliveryOffset: 2, deliveryStatus: "processing", stockConfirmed: false, installationRequired: false, installationStatus: "not_required", mlContext: { provenance: "synthetic_demo", inventoryAvailableAtCreation: false, deliveryZone: "rural", distanceKm: 120, carrierId: "CARRIER-C", installationSlotAvailableAtCutoff: null } },
  { id: "DEMO-1007", product: "Induction cooktop", deliveryOffset: -1, deliveryStatus: "dispatched", stockConfirmed: true, installationRequired: true, installationStatus: "not_scheduled" },
  { id: "DEMO-1008", product: '55" LED television', deliveryOffset: 3, deliveryStatus: "dispatched", stockConfirmed: true, installationRequired: false, installationStatus: "not_required", mlContext: { provenance: "synthetic_demo", inventoryAvailableAtCreation: true, deliveryZone: "urban", distanceKm: 9, carrierId: "CARRIER-A", installationSlotAvailableAtCutoff: null } },
  { id: "DEMO-1009", product: "Washer-dryer combo", deliveryOffset: -1, deliveredOffset: -1, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: true, installationStatus: "not_scheduled" },
  { id: "DEMO-1010", product: "Built-in oven", deliveryOffset: -5, deliveredOffset: -5, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: true, installationStatus: "scheduled", installationOffset: -1 },
  { id: "DEMO-1011", product: "Chest freezer", deliveryOffset: -3, deliveredOffset: -3, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: false, installationStatus: "not_required" },
  { id: "DEMO-1012", product: "Slimline dishwasher", deliveryOffset: 9, deliveryStatus: "processing", stockConfirmed: true, installationRequired: true, installationStatus: "not_scheduled", mlContext: { provenance: "synthetic_demo", inventoryAvailableAtCreation: true, deliveryZone: "rural", distanceKm: 85, carrierId: "CARRIER-B", installationSlotAvailableAtCutoff: true } },
  { id: "DEMO-1013", product: "Range hood", deliveryOffset: 0, deliveryStatus: "processing", stockConfirmed: true, installationRequired: true, installationStatus: "not_scheduled" },
  { id: "DEMO-1014", product: "Top-load washing machine", deliveryOffset: 4, deliveryStatus: "dispatched", stockConfirmed: true, installationRequired: true, installationStatus: "scheduled", installationOffset: 5, mlContext: { provenance: "synthetic_demo", inventoryAvailableAtCreation: true, deliveryZone: "suburban", distanceKm: 33, carrierId: "CARRIER-C", installationSlotAvailableAtCutoff: true } },
  { id: "DEMO-1015", product: "Wine cooler", deliveryOffset: -8, deliveredOffset: -8, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: false, installationStatus: "not_required" },
  { id: "DEMO-1016", product: '75" QLED television', deliveryOffset: -7, deliveredOffset: -7, deliveryStatus: "delivered", stockConfirmed: true, installationRequired: true, installationStatus: "completed", installationOffset: -6 },
];

export function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function offset(today: Date, days: number): string {
  return toISODate(new Date(today.getTime() + days * 86_400_000));
}

export function getDemoOrders(now: Date = new Date()): Order[] {
  const today = startOfDayUTC(now);
  return seeds.map(({ deliveryOffset, deliveredOffset, installationOffset, ...rest }) => ({
    ...rest,
    expectedDelivery: offset(today, deliveryOffset),
    deliveredOn: deliveredOffset === undefined ? null : offset(today, deliveredOffset),
    installationDate: installationOffset === undefined ? null : offset(today, installationOffset),
  }));
}

/** Shared intervention records for the dashboard and the future Intervention Center. */
export const demoInterventions: Intervention[] = [
  { id: "INT-01", orderId: "DEMO-1002", action: "Contact customer to book installation slot", status: "open", factorCode: "install_unscheduled_long", origin: "seed" },
  { id: "INT-02", orderId: "DEMO-1001", action: "Escalate dispatch with warehouse", status: "in_progress", factorCode: "not_dispatched_due_soon", origin: "seed" },
  { id: "INT-03", orderId: "DEMO-1005", action: "Confirm installation completion with technician", status: "completed", origin: "seed" },
];
