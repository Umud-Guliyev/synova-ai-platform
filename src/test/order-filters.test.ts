import { describe, expect, it } from "vitest";
import { getDemoOrders } from "@/data/demo-orders";
import { assessAll, assessOrder, summarize } from "@/lib/risk";
import { DEFAULT_FILTERS, applyFilters, isDefault, parseFilters, type OrderFilters } from "@/lib/order-filters";

const NOW = new Date("2026-10-09T12:00:00Z");
const all = assessAll(getDemoOrders(NOW), NOW);
const run = (f: Partial<OrderFilters>) => applyFilters(all, { ...DEFAULT_FILTERS, ...f });

describe("search", () => {
  it("finds by order ID", () => {
    expect(run({ q: "demo-1007" }).map((o) => o.id)).toEqual(["DEMO-1007"]);
  });
  it("finds by product name", () => {
    expect(run({ q: "television" }).map((o) => o.id).sort()).toEqual(["DEMO-1003", "DEMO-1008", "DEMO-1016"]);
  });
});

describe("filters", () => {
  it("combine risk, delivery and installation", () => {
    const r = run({ risk: "high", delivery: "delivered", installation: "not_scheduled" });
    expect(r.map((o) => o.id)).toEqual(["DEMO-1002"]);
  });
  it("search and filter work together", () => {
    expect(run({ q: "dishwasher", installation: "scheduled" }).map((o) => o.id)).toEqual(["DEMO-1004"]);
  });
  it("no match returns empty", () => {
    expect(run({ q: "nothing-here" })).toHaveLength(0);
  });
});

describe("sorting", () => {
  it("highest risk first", () => {
    const s = run({ sort: "risk_desc" }).map((o) => o.assessment.score);
    expect(s).toEqual([...s].sort((a, b) => b - a));
  });
  it("lowest risk first", () => {
    const s = run({ sort: "risk_asc" }).map((o) => o.assessment.score);
    expect(s).toEqual([...s].sort((a, b) => a - b));
  });
  it("earliest delivery first", () => {
    const d = run({ sort: "delivery_asc" }).map((o) => o.expectedDelivery);
    expect(d).toEqual([...d].sort());
  });
  it("latest delivery first", () => {
    const d = run({ sort: "delivery_desc" }).map((o) => o.expectedDelivery);
    expect(d).toEqual([...d].sort().reverse());
  });
});

describe("summary and reset", () => {
  it("summary counts reflect filtered records", () => {
    const s = summarize(run({ risk: "medium" }));
    expect(s).toMatchObject({ total: 3, risk: { high: 0, medium: 3, low: 0 } });
  });
  it("invalid URL values fall back to defaults", () => {
    expect(parseFilters({ risk: "extreme", sort: "x" })).toEqual(DEFAULT_FILTERS);
  });
  it("defaults are detected as reset state and show all orders", () => {
    expect(isDefault(parseFilters({}))).toBe(true);
    expect(run({})).toHaveLength(16);
  });
  it("displayed risk levels match the shared risk logic", () => {
    for (const o of all) expect(o.assessment.level).toBe(assessOrder(o, NOW).level);
  });
});
