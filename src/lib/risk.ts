import type { Intervention, InterventionStatus, Order } from "@/data/demo-orders";
import { startOfDayUTC } from "@/data/demo-orders";
import type { RiskLevel } from "@/components/RiskBadge";

/**
 * Transparent, rule-based demo risk assessment.
 * The score is a rule-based priority score (0–100), NOT a probability of delay.
 */
export type RiskCategory = "delivery" | "installation" | "stock";
export type RiskFactorCode =
  | "not_dispatched_overdue"
  | "not_dispatched_due_soon"
  | "stock_unconfirmed"
  | "in_transit_late"
  | "install_unscheduled_long"
  | "install_unscheduled"
  | "install_overdue";
export type RiskFactor = { code: RiskFactorCode; category: RiskCategory; points: number; description: string };
export type Assessment = {
  score: number;
  level: Exclude<RiskLevel, "info">;
  factors: RiskFactor[];
  primaryFactor: string | null;
};

const DAY = 86_400_000;
function daysBetween(fromISO: string, today: Date): number {
  return Math.round((new Date(fromISO + "T00:00:00Z").getTime() - today.getTime()) / DAY);
}
const plural = (n: number) => `${n} day${n === 1 ? "" : "s"}`;

export const RISK_THRESHOLDS = { high: 60, medium: 30 } as const;

export function assessOrder(order: Order, now: Date = new Date()): Assessment {
  const today = startOfDayUTC(now);
  const factors: RiskFactor[] = [];
  const daysToDelivery = daysBetween(order.expectedDelivery, today);

  if (order.deliveryStatus === "processing") {
    if (daysToDelivery < 0) {
      factors.push({ code: "not_dispatched_overdue", category: "delivery", points: 80, description: `Delivery date passed ${plural(-daysToDelivery)} ago; not dispatched` });
    } else if (daysToDelivery <= 2) {
      factors.push({ code: "not_dispatched_due_soon", category: "delivery", points: 60, description: daysToDelivery === 0 ? "Delivery due today; not dispatched" : `Delivery due in ${plural(daysToDelivery)}; not dispatched` });
    }
    if (!order.stockConfirmed) {
      factors.push({ code: "stock_unconfirmed", category: "stock", points: 25, description: "Stock allocation not confirmed" });
    }
  } else if (order.deliveryStatus === "dispatched" && daysToDelivery < 0) {
    factors.push({ code: "in_transit_late", category: "delivery", points: 50, description: `In transit ${plural(-daysToDelivery)} past expected delivery` });
  }

  if (order.deliveryStatus === "delivered" && order.installationRequired) {
    if (order.installationStatus === "not_scheduled") {
      const since = order.deliveredOn ? -daysBetween(order.deliveredOn, today) : 0;
      factors.push(
        since >= 3
          ? { code: "install_unscheduled_long", category: "installation", points: 60, description: `Delivered ${plural(since)} ago; installation not scheduled` }
          : { code: "install_unscheduled", category: "installation", points: 35, description: "Delivered; installation not yet scheduled" },
      );
    } else if (order.installationStatus === "scheduled" && order.installationDate && daysBetween(order.installationDate, today) < 0) {
      factors.push({ code: "install_overdue", category: "installation", points: 55, description: "Scheduled installation date passed; not completed" });
    }
  }

  factors.sort((a, b) => b.points - a.points);
  const score = Math.min(100, factors.reduce((s, f) => s + f.points, 0));
  const level = score >= RISK_THRESHOLDS.high ? "high" : score >= RISK_THRESHOLDS.medium ? "medium" : "low";
  return { score, level, factors, primaryFactor: factors[0]?.description ?? null };
}

export type FulfillmentStage = "completed" | "awaiting_installation" | "awaiting_delivery";

/** Delivery and installation are separate stages; each order maps to exactly one stage. */
export function fulfillmentStage(order: Order): FulfillmentStage {
  if (order.deliveryStatus !== "delivered") return "awaiting_delivery";
  if (order.installationRequired && order.installationStatus !== "completed") return "awaiting_installation";
  return "completed";
}

export type AssessedOrder = Order & { assessment: Assessment; stage: FulfillmentStage };

export function assessAll(orders: Order[], now: Date = new Date()): AssessedOrder[] {
  return orders.map((o) => ({ ...o, assessment: assessOrder(o, now), stage: fulfillmentStage(o) }));
}

export function prioritize(orders: AssessedOrder[]): AssessedOrder[] {
  return [...orders].sort(
    (a, b) => b.assessment.score - a.assessment.score || a.expectedDelivery.localeCompare(b.expectedDelivery),
  );
}

export const DELAY_CODES: readonly RiskFactorCode[] = ["not_dispatched_overdue", "in_transit_late"];

export function summarize(orders: AssessedOrder[]) {
  const count = (fn: (o: AssessedOrder) => boolean) => orders.filter(fn).length;
  return {
    total: orders.length,
    risk: {
      high: count((o) => o.assessment.level === "high"),
      medium: count((o) => o.assessment.level === "medium"),
      low: count((o) => o.assessment.level === "low"),
    },
    atRisk: count((o) => o.assessment.level !== "low"),
    /** Delayed = promised delivery date already passed and not delivered. Due-soon orders are at risk, not delayed. */
    deliveryDelays: count((o) => o.assessment.factors.some((f) => DELAY_CODES.includes(f.code))),
    fulfillment: {
      completed: count((o) => o.stage === "completed"),
      awaitingInstallation: count((o) => o.stage === "awaiting_installation"),
      awaitingDelivery: count((o) => o.stage === "awaiting_delivery"),
    },
  };
}

export function groupInterventions(list: Intervention[]): Record<InterventionStatus, Intervention[]> {
  return {
    open: list.filter((i) => i.status === "open"),
    in_progress: list.filter((i) => i.status === "in_progress"),
    completed: list.filter((i) => i.status === "completed"),
  };
}

/** Plain-language operational meaning of each rule. */
export const FACTOR_MEANING: Record<RiskFactorCode, string> = {
  not_dispatched_overdue: "The promised delivery date has already passed and the order has not left the warehouse, so the customer is already affected.",
  not_dispatched_due_soon: "The order has not been dispatched and little time remains before the promised delivery date, leaving limited margin for handling and transport.",
  stock_unconfirmed: "Stock has not been allocated to this order, so dispatch may not be possible even if transport is available.",
  in_transit_late: "The order is in transit but has passed its expected delivery date, which may indicate a carrier or routing issue.",
  install_unscheduled_long: "The product was delivered several days ago but no installation is booked, so the customer cannot use it yet.",
  install_unscheduled: "The product was delivered recently and installation is required but not yet booked.",
  install_overdue: "The scheduled installation date has passed without the installation being recorded as completed.",
};

/** Suggested (not performed) actions per rule. */
export const FACTOR_RECOMMENDATION: Record<RiskFactorCode, string> = {
  not_dispatched_overdue: "Escalate with the warehouse and inform the customer of a revised delivery date.",
  not_dispatched_due_soon: "Verify dispatch readiness with the warehouse and confirm a carrier slot.",
  stock_unconfirmed: "Confirm stock allocation or identify an alternative source.",
  in_transit_late: "Check shipment status with the carrier and update the customer.",
  install_unscheduled_long: "Contact the customer to book an installation slot as a priority.",
  install_unscheduled: "Schedule installation with the customer and an available technician.",
  install_overdue: "Confirm with the technician whether installation took place and reschedule if needed.",
};

export function recommendations(a: Assessment): string[] {
  return [...new Set(a.factors.map((f) => FACTOR_RECOMMENDATION[f.code]))];
}

export type StageState = "completed" | "current" | "pending" | "not_applicable";
export type TimelineStage = { key: string; label: string; state: StageState; date: string | null };

/** Lifecycle stages derived only from fields on the order record (no invented events). */
export function orderTimeline(o: Order): TimelineStage[] {
  const dispatched = o.deliveryStatus !== "processing";
  const delivered = o.deliveryStatus === "delivered";
  const scheduled = o.installationStatus === "scheduled" || o.installationStatus === "completed";
  const installed = o.installationStatus === "completed";
  const raw: { key: string; label: string; done: boolean; date: string | null; na?: boolean }[] = [
    { key: "dispatched", label: "Dispatched", done: dispatched, date: null },
    { key: "delivered", label: "Delivered", done: delivered, date: o.deliveredOn },
    { key: "install_scheduled", label: "Installation scheduled", done: scheduled, date: o.installationStatus === "scheduled" ? o.installationDate : null, na: !o.installationRequired },
    { key: "installed", label: "Installation completed", done: installed, date: installed ? o.installationDate : null, na: !o.installationRequired },
  ];
  let currentSet = false;
  return raw.map((r) => {
    let state: StageState;
    if (r.na) state = "not_applicable";
    else if (r.done) state = "completed";
    else if (!currentSet) { state = "current"; currentSet = true; }
    else state = "pending";
    return { key: r.key, label: r.label, state, date: r.date };
  });
}

export function findOrder(orders: AssessedOrder[], id: string): AssessedOrder | undefined {
  return orders.find((o) => o.id.toLowerCase() === id.toLowerCase());
}

/** Counts per delivery and installation status, keyed by the data model's own values. */
export function statusDistribution(orders: Order[]) {
  const delivery = { processing: 0, dispatched: 0, delivered: 0 } as Record<Order["deliveryStatus"], number>;
  const installation = { not_required: 0, not_scheduled: 0, scheduled: 0, completed: 0 } as Record<Order["installationStatus"], number>;
  for (const o of orders) {
    delivery[o.deliveryStatus] += 1;
    installation[o.installationStatus] += 1;
  }
  return { delivery, installation };
}

/** Signal categories the rules actually use, with the rule codes in each. */
export const RULE_SIGNALS: { category: RiskCategory; label: string; codes: RiskFactorCode[] }[] = [
  { category: "delivery", label: "Dispatch status vs. expected delivery date", codes: ["not_dispatched_overdue", "not_dispatched_due_soon", "in_transit_late"] },
  { category: "stock", label: "Stock allocation before dispatch", codes: ["stock_unconfirmed"] },
  { category: "installation", label: "Installation scheduling after delivery", codes: ["install_unscheduled_long", "install_unscheduled", "install_overdue"] },
];
