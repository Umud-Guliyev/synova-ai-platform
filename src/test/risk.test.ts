import { describe, expect, it } from "vitest";
import { getDemoOrders, type Order } from "@/data/demo-orders";
import { assessAll, assessOrder, fulfillmentStage, summarize } from "@/lib/risk";

const NOW = new Date("2026-10-09T12:00:00Z");
const base: Order = {
  id: "T-1", product: "Test", expectedDelivery: "2026-10-10", deliveryStatus: "processing", deliveredOn: null,
  stockConfirmed: true, installationRequired: false, installationStatus: "not_required", installationDate: null,
};

describe("risk rules", () => {
  it("not dispatched with delivery due within 2 days is high risk", () => {
    expect(assessOrder(base, NOW).level).toBe("high");
  });
  it("delivered with installation not scheduled for 3+ days is high risk", () => {
    const o = { ...base, deliveryStatus: "delivered" as const, deliveredOn: "2026-10-05", installationRequired: true, installationStatus: "not_scheduled" as const };
    expect(assessOrder(o, NOW).level).toBe("high");
  });
  it("order progressing normally has no risk", () => {
    expect(assessOrder({ ...base, expectedDelivery: "2026-10-20" }, NOW).score).toBe(0);
  });
});

describe("fulfillment", () => {
  it("delivered order with pending installation is not completed", () => {
    const o = { ...base, deliveryStatus: "delivered" as const, installationRequired: true, installationStatus: "scheduled" as const };
    expect(fulfillmentStage(o)).toBe("awaiting_installation");
  });
  it("delivered and installed order is completed", () => {
    const o = { ...base, deliveryStatus: "delivered" as const, installationRequired: true, installationStatus: "completed" as const };
    expect(fulfillmentStage(o)).toBe("completed");
  });
});

describe("demo summary consistency", () => {
  const s = summarize(assessAll(getDemoOrders(NOW), NOW));
  it("risk levels add up to total", () => {
    expect(s.risk.high + s.risk.medium + s.risk.low).toBe(s.total);
  });
  it("fulfillment stages add up to total with no double counting", () => {
    expect(s.fulfillment.completed + s.fulfillment.awaitingInstallation + s.fulfillment.awaitingDelivery).toBe(s.total);
  });
});
