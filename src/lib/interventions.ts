import type { Intervention, InterventionStatus } from "@/data/demo-orders";
import { FACTOR_RECOMMENDATION, type RiskFactor } from "@/lib/risk";

export const INTERVENTION_STATUSES: InterventionStatus[] = ["open", "in_progress", "completed"];
export const statusLabel: Record<InterventionStatus, string> = {
  open: "Open",
  in_progress: "In progress",
  completed: "Completed",
};

export function isStatus(v: unknown): v is InterventionStatus {
  return typeof v === "string" && (INTERVENTION_STATUSES as string[]).includes(v);
}

export function countByStatus(list: Intervention[]): Record<InterventionStatus, number> {
  return {
    open: list.filter((i) => i.status === "open").length,
    in_progress: list.filter((i) => i.status === "in_progress").length,
    completed: list.filter((i) => i.status === "completed").length,
  };
}

/** Returns a new list; unknown IDs or unsupported statuses leave the list unchanged. */
export function setStatus(list: Intervention[], id: string, status: unknown): Intervention[] {
  if (!isStatus(status) || !list.some((i) => i.id === id)) return list;
  return list.map((i) => (i.id === id ? { ...i, status } : i));
}

export function findActive(list: Intervention[], orderId: string, code: RiskFactor["code"]): Intervention | undefined {
  return list.find((i) => i.orderId === orderId && i.factorCode === code && i.status !== "completed");
}

/** Creates an open demo intervention from a shared risk factor, unless an active one already exists. */
export function createFromFactor(
  list: Intervention[],
  orderId: string,
  factor: RiskFactor,
): { list: Intervention[]; created: Intervention | null } {
  if (findActive(list, orderId, factor.code)) return { list, created: null };
  const next = list.reduce((m, i) => Math.max(m, Number(i.id.replace(/\D/g, "")) || 0), 0) + 1;
  const created: Intervention = {
    id: `INT-${String(next).padStart(2, "0")}`,
    orderId,
    action: FACTOR_RECOMMENDATION[factor.code],
    status: "open",
    factorCode: factor.code,
    origin: "demo_ui",
  };
  return { list: [...list, created], created };
}
