import { describe, expect, it } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "@/routeTree.gen";
import { demoInterventions, getDemoOrders } from "@/data/demo-orders";
import { assessAll, findOrder } from "@/lib/risk";
import { countByStatus, createFromFactor, setStatus } from "@/lib/interventions";

const NOW = new Date("2026-10-09T12:00:00Z");
const orders = assessAll(getDemoOrders(NOW), NOW);

describe("intervention counts and status", () => {
  it("counts match the seed records", () => {
    expect(countByStatus(demoInterventions)).toEqual({ open: 1, in_progress: 1, completed: 1 });
  });
  it("status update changes only the target and updates counts", () => {
    const next = setStatus(demoInterventions, "INT-01", "completed");
    expect(next.find((i) => i.id === "INT-01")?.status).toBe("completed");
    expect(next.find((i) => i.id === "INT-02")?.status).toBe("in_progress");
    expect(countByStatus(next)).toEqual({ open: 0, in_progress: 1, completed: 2 });
  });
  it("rejects unsupported statuses and unknown IDs", () => {
    expect(setStatus(demoInterventions, "INT-01", "cancelled")).toBe(demoInterventions);
    expect(setStatus(demoInterventions, "INT-99", "open")).toBe(demoInterventions);
  });
  it("empty list has zero counts", () => {
    expect(countByStatus([])).toEqual({ open: 0, in_progress: 0, completed: 0 });
  });
});

describe("create from risk factor", () => {
  it("creates an open intervention linked to the order with the shared recommendation", () => {
    const o = findOrder(orders, "DEMO-1013")!;
    const { created, list } = createFromFactor(demoInterventions, o.id, o.assessment.factors[0]!);
    expect(created).toMatchObject({ orderId: "DEMO-1013", status: "open", origin: "demo_ui", id: "INT-04" });
    expect(list).toHaveLength(4);
  });
  it("prevents duplicate active interventions for the same order and reason", () => {
    const o = findOrder(orders, "DEMO-1001")!;
    const f = o.assessment.factors.find((x) => x.code === "not_dispatched_due_soon")!;
    expect(createFromFactor(demoInterventions, o.id, f).created).toBeNull();
  });
  it("allows a new one once the previous is completed", () => {
    const o = findOrder(orders, "DEMO-1001")!;
    const f = o.assessment.factors.find((x) => x.code === "not_dispatched_due_soon")!;
    const done = setStatus(demoInterventions, "INT-02", "completed");
    expect(createFromFactor(done, o.id, f).created).not.toBeNull();
  });
});

describe("order references", () => {
  it("every seed intervention links to an existing order", () => {
    for (const i of demoInterventions) expect(findOrder(orders, i.orderId)).toBeDefined();
  });
  it("missing order references resolve to undefined safely", () => {
    expect(findOrder(orders, "DEMO-0000")).toBeUndefined();
  });
  it("intervention order links match the order details route", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    const m = router.matchRoutes("/orders/DEMO-1002").at(-1);
    expect(m?.routeId).toBe("/_authenticated/orders/$orderId");
    expect(m?.params).toMatchObject({ orderId: "DEMO-1002" });
  });
});
