import { describe, expect, it } from "vitest";
import { demoInterventions, getDemoOrders } from "@/data/demo-orders";
import { assessAll, assessOrder, statusDistribution, summarize, RULE_SIGNALS, FACTOR_MEANING } from "@/lib/risk";
import { countByStatus, setStatus } from "@/lib/interventions";

const NOW = new Date("2026-10-09T12:00:00Z");
const raw = getDemoOrders(NOW);
const orders = assessAll(raw, NOW);

describe("analytics totals", () => {
  it("total and status distributions agree with the 16 demo orders", () => {
    const d = statusDistribution(raw);
    expect(Object.values(d.delivery).reduce((a, b) => a + b, 0)).toBe(16);
    expect(Object.values(d.installation).reduce((a, b) => a + b, 0)).toBe(16);
    expect(d.delivery.delivered).toBe(raw.filter((o) => o.deliveryStatus === "delivered").length);
  });
  it("risk distribution agrees with the shared risk calculation", () => {
    const s = summarize(orders);
    expect(s.risk.high).toBe(raw.filter((o) => assessOrder(o, NOW).level === "high").length);
    expect(s.risk.high + s.risk.medium + s.risk.low).toBe(16);
  });
  it("delivered orders awaiting installation are not counted as completed", () => {
    const s = summarize(orders);
    const awaiting = raw.filter((o) => o.deliveryStatus === "delivered" && o.installationRequired && o.installationStatus !== "completed").length;
    expect(s.fulfillment.awaitingInstallation).toBe(awaiting);
    expect(s.fulfillment.completed).toBe(16 - awaiting - s.fulfillment.awaitingDelivery);
  });
  it("intervention counts follow the current state", () => {
    expect(countByStatus(setStatus(demoInterventions, "INT-02", "completed"))).toEqual({ open: 1, in_progress: 0, completed: 2 });
  });
  it("empty data summarizes safely to zero", () => {
    const s = summarize([]);
    expect(s).toMatchObject({ total: 0, atRisk: 0, risk: { high: 0, medium: 0, low: 0 } });
    expect(Object.values(statusDistribution([]).delivery)).toEqual([0, 0, 0]);
  });
  it("documented rule signals cover every rule exactly once", () => {
    const codes = RULE_SIGNALS.flatMap((g) => g.codes).sort();
    expect(codes).toEqual(Object.keys(FACTOR_MEANING).sort());
  });
});
