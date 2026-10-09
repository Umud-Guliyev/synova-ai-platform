import type { DeliveryStatus, InstallationStatus } from "@/data/demo-orders";
import type { AssessedOrder } from "@/lib/risk";

export const DELIVERY_STATUSES: DeliveryStatus[] = ["processing", "dispatched", "delivered"];
export const INSTALLATION_STATUSES: InstallationStatus[] = ["not_required", "not_scheduled", "scheduled", "completed"];
export const RISK_FILTERS = ["all", "high", "medium", "low"] as const;
export const SORT_OPTIONS = ["risk_desc", "risk_asc", "delivery_asc", "delivery_desc"] as const;

export type RiskFilter = (typeof RISK_FILTERS)[number];
export type SortOption = (typeof SORT_OPTIONS)[number];

export type OrderFilters = {
  q: string;
  risk: RiskFilter;
  delivery: DeliveryStatus | "all";
  installation: InstallationStatus | "all";
  sort: SortOption;
};

export const DEFAULT_FILTERS: OrderFilters = { q: "", risk: "all", delivery: "all", installation: "all", sort: "risk_desc" };

export const deliveryLabel: Record<DeliveryStatus, string> = {
  processing: "Not dispatched",
  dispatched: "In transit",
  delivered: "Delivered",
};
export const installLabel: Record<InstallationStatus, string> = {
  not_required: "Not required",
  not_scheduled: "Not scheduled",
  scheduled: "Scheduled",
  completed: "Completed",
};
export const riskFilterLabel: Record<RiskFilter, string> = { all: "All risk levels", high: "High risk", medium: "Medium risk", low: "On track" };
export const sortLabel: Record<SortOption, string> = {
  risk_desc: "Highest risk first",
  risk_asc: "Lowest risk first",
  delivery_asc: "Earliest delivery first",
  delivery_desc: "Latest delivery first",
};

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Parse untrusted URL search params into valid filters (unknown values fall back to defaults). */
export function parseFilters(search: { q?: unknown; risk?: unknown; delivery?: unknown; installation?: unknown; sort?: unknown }): OrderFilters {
  return {
    q: typeof search.q === "string" ? search.q.slice(0, 100) : "",
    risk: pick(search.risk, RISK_FILTERS, "all"),
    delivery: pick(search.delivery, ["all", ...DELIVERY_STATUSES] as const, "all"),
    installation: pick(search.installation, ["all", ...INSTALLATION_STATUSES] as const, "all"),
    sort: pick(search.sort, SORT_OPTIONS, "risk_desc"),
  };
}

export function isDefault(f: OrderFilters): boolean {
  return (Object.keys(DEFAULT_FILTERS) as (keyof OrderFilters)[]).every((k) => f[k] === DEFAULT_FILTERS[k]);
}

export function applyFilters(orders: AssessedOrder[], f: OrderFilters): AssessedOrder[] {
  const q = f.q.trim().toLowerCase();
  const filtered = orders.filter(
    (o) =>
      (!q || o.id.toLowerCase().includes(q) || o.product.toLowerCase().includes(q)) &&
      (f.risk === "all" || o.assessment.level === f.risk) &&
      (f.delivery === "all" || o.deliveryStatus === f.delivery) &&
      (f.installation === "all" || o.installationStatus === f.installation),
  );
  const byDate = (a: AssessedOrder, b: AssessedOrder) => a.expectedDelivery.localeCompare(b.expectedDelivery);
  const byId = (a: AssessedOrder, b: AssessedOrder) => a.id.localeCompare(b.id);
  const cmp: Record<SortOption, (a: AssessedOrder, b: AssessedOrder) => number> = {
    risk_desc: (a, b) => b.assessment.score - a.assessment.score || byDate(a, b) || byId(a, b),
    risk_asc: (a, b) => a.assessment.score - b.assessment.score || byDate(a, b) || byId(a, b),
    delivery_asc: (a, b) => byDate(a, b) || byId(a, b),
    delivery_desc: (a, b) => byDate(b, a) || byId(a, b),
  };
  return [...filtered].sort(cmp[f.sort]);
}
