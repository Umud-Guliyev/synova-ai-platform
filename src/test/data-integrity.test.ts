import { describe, expect, it } from "vitest";
import { demoInterventions, getDemoOrders } from "@/data/demo-orders";
import { assessAll, summarize, statusDistribution } from "@/lib/risk";
import { validateCredentials } from "@/lib/auth";

const NOW = new Date("2026-10-09T12:00:00Z");
const raw = getDemoOrders(NOW);
const orders = assessAll(raw, NOW);

describe("demo order integrity", () => {
  it("has unique IDs and no impossible state combinations", () => {
    expect(new Set(raw.map((o) => o.id)).size).toBe(raw.length);
    for (const o of raw) {
      expect(o.deliveredOn !== null).toBe(o.deliveryStatus === "delivered");
      if (!o.installationRequired) expect(o.installationStatus).toBe("not_required");
      else expect(o.installationStatus).not.toBe("not_required");
      if (o.installationStatus === "completed") expect(o.deliveryStatus).toBe("delivered");
      if (o.mlContext) expect(o.mlContext.provenance).toBe("synthetic_demo");
    }
  });
  it("every intervention references an existing order and a rule that order triggers", () => {
    for (const i of demoInterventions) {
      const o = orders.find((x) => x.id === i.orderId);
      expect(o).toBeDefined();
      if (i.factorCode) expect(o!.assessment.factors.map((f) => f.code)).toContain(i.factorCode);
    }
  });
});

describe("delivery delay definition", () => {
  it("counts only orders already past the promised date, not orders merely due soon", () => {
    // 1007 is in transit past its date; 1001/1006/1013 are due soon and only at risk.
    expect(summarize(orders).deliveryDelays).toBe(1);
  });
  it("cross-page totals reconcile", () => {
    const s = summarize(orders);
    const d = statusDistribution(raw);
    expect(s.total).toBe(16);
    expect(d.delivery.processing + d.delivery.dispatched).toBe(s.fulfillment.awaitingDelivery);
  });
});

describe("form validation", () => {
  it("rejects bad email, empty password, and short register password", () => {
    expect(validateCredentials("nope", "x", "login")).toMatch(/email/);
    expect(validateCredentials("a@b.co", "", "login")).toMatch(/password/);
    expect(validateCredentials("a@b.co", "1234567", "register")).toMatch(/8/);
    expect(validateCredentials("a@b.co", "1234567", "login")).toBeNull();
  });
});
