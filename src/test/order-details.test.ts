import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import { routeTree } from "@/routeTree.gen";
import { getDemoOrders, type Order } from "@/data/demo-orders";
import { assessAll, assessOrder, findOrder, orderTimeline, recommendations, fulfillmentStage } from "@/lib/risk";

const NOW = new Date("2026-10-09T12:00:00Z");
const all = assessAll(getDemoOrders(NOW), NOW);
const base: Order = {
  id: "T-1", product: "Test", expectedDelivery: "2026-10-20", deliveryStatus: "processing", deliveredOn: null,
  stockConfirmed: true, installationRequired: true, installationStatus: "not_scheduled", installationDate: null,
};

describe("order details route", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
  it("matches the detail route with the order ID from either source", () => {
    for (const from of ["dashboard", "orders"]) {
      const m = router.matchRoutes("/orders/DEMO-1002", { from }).at(-1);
      expect(m?.routeId).toBe("/_authenticated/orders/$orderId");
      expect(m?.params).toMatchObject({ orderId: "DEMO-1002" });
      expect(m?.search).toMatchObject({ from });
    }
  });
  it("keeps /orders on the monitor list", () => {
    expect(router.matchRoutes("/orders").at(-1)?.routeId).toBe("/_authenticated/orders/");
  });
});

describe("order lookup", () => {
  it("finds the shared order and its shared assessment", () => {
    const o = findOrder(all, "DEMO-1002")!;
    expect(o.assessment).toEqual(assessOrder(o, NOW));
  });
  it("returns undefined for unknown IDs", () => {
    expect(findOrder(all, "DEMO-9999")).toBeUndefined();
  });
});

describe("timeline and fulfillment", () => {
  it("delivered order awaiting installation is not completed", () => {
    const o = { ...base, deliveryStatus: "delivered" as const, deliveredOn: "2026-10-05" };
    expect(fulfillmentStage(o)).toBe("awaiting_installation");
    const t = orderTimeline(o);
    expect(t.find((s) => s.key === "delivered")?.state).toBe("completed");
    expect(t.find((s) => s.key === "install_scheduled")?.state).toBe("current");
    expect(t.find((s) => s.key === "installed")?.state).toBe("pending");
  });
  it("missing dates stay null rather than invented", () => {
    const t = orderTimeline(base);
    expect(t.every((s) => s.date === null)).toBe(true);
    expect(t.map((s) => s.state)).toEqual(["current", "pending", "pending", "pending"]);
  });
  it("installation stages are not applicable when not required", () => {
    const t = orderTimeline({ ...base, installationRequired: false, installationStatus: "not_required" });
    expect(t.slice(2).map((s) => s.state)).toEqual(["not_applicable", "not_applicable"]);
  });
  it("orders without risk factors get no recommendations", () => {
    expect(recommendations(assessOrder(base, NOW))).toEqual([]);
  });
});
