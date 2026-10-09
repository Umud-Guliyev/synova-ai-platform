import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { FlaskConical, RotateCcw, Search, SearchX, SlidersHorizontal, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, PageBody, Section } from "@/components/layout/Page";
import { RiskBadge } from "@/components/RiskBadge";
import { OrderTable } from "@/components/orders/OrderTable";
import { getDemoOrders } from "@/data/demo-orders";
import { assessAll, summarize } from "@/lib/risk";
import {
  DEFAULT_FILTERS, DELIVERY_STATUSES, INSTALLATION_STATUSES, RISK_FILTERS, SORT_OPTIONS,
  applyFilters, deliveryLabel, installLabel, isDefault, parseFilters, riskFilterLabel, sortLabel,
  type OrderFilters,
} from "@/lib/order-filters";

const DESCRIPTION = "Identify delivery and installation risks before they become operational delays.";

export const Route = createFileRoute("/_authenticated/orders/")({
  validateSearch: (search: Record<string, unknown>) => parseFilters(search),
  head: () => ({
    meta: [
      { title: "Order Risk Monitor — SYNOVA AI" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Order Risk Monitor — SYNOVA AI" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: OrderRiskMonitor,
});

function FilterSelect({
  id, label, value, onChange, options, active = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  active?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">{label}{active && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="(filter applied)" />}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-9 w-full rounded-md border bg-surface-1 px-3 text-sm text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "border-primary/60" : "border-input"}`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

function SummaryCard({ label, value, children }: { label: string; value: number; children?: ReactNode }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]" aria-label={`${label}: ${value}`}>
      <div className="flex min-h-6 items-center">{children ?? <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>}</div>
      <p className="mt-2 font-mono text-2xl tabular">{value}</p>
    </li>
  );
}

function OrderRiskMonitor() {
  const filters = Route.useSearch();
  const navigate = useNavigate({ from: "/orders/" });

  const all = useMemo(() => assessAll(getDemoOrders()), []);
  const visible = useMemo(() => applyFilters(all, filters), [all, filters]);
  const s = summarize(visible);

  const set = <K extends keyof OrderFilters>(key: K, value: OrderFilters[K]) =>
    navigate({ search: (prev) => ({ ...prev, [key]: value }), replace: key === "q" });
  const reset = () => navigate({ search: DEFAULT_FILTERS });
  const chips: { key: keyof OrderFilters; label: string }[] = [
    ...(filters.q ? [{ key: "q" as const, label: `Search: “${filters.q}”` }] : []),
    ...(filters.risk !== DEFAULT_FILTERS.risk ? [{ key: "risk" as const, label: `Risk: ${riskFilterLabel[filters.risk]}` }] : []),
    ...(filters.delivery !== DEFAULT_FILTERS.delivery ? [{ key: "delivery" as const, label: `Delivery: ${deliveryLabel[filters.delivery as keyof typeof deliveryLabel]}` }] : []),
    ...(filters.installation !== DEFAULT_FILTERS.installation ? [{ key: "installation" as const, label: `Installation: ${installLabel[filters.installation as keyof typeof installLabel]}` }] : []),
    ...(filters.sort !== DEFAULT_FILTERS.sort ? [{ key: "sort" as const, label: `Sort: ${sortLabel[filters.sort]}` }] : []),
  ];

  return (
    <>
      <PageHeader
        title="Order Risk Monitor"
        description={DESCRIPTION}
        actions={
          <>
            <Badge variant="muted" className="font-mono">
              {visible.length} matching
            </Badge>
            <Badge variant="info" className="gap-1.5">
              <FlaskConical className="h-3 w-3" aria-hidden /> Illustrative demo data
            </Badge>
          </>
        }
      />
      <PageBody>
        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Risk summary for filtered orders">
          <SummaryCard label="All orders" value={s.total} />
          <SummaryCard label="High risk" value={s.risk.high}><RiskBadge level="high" /></SummaryCard>
          <SummaryCard label="Medium risk" value={s.risk.medium}><RiskBadge level="medium" /></SummaryCard>
          <SummaryCard label="On track" value={s.risk.low}><RiskBadge level="low" /></SummaryCard>
        </ul>

        <div className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]" role="search" aria-label="Filter orders">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-end lg:grid-cols-3 2xl:grid-cols-[minmax(0,1.4fr)_repeat(4,minmax(11rem,1fr))_auto]">
            <div className="min-w-0">
              <label htmlFor="order-search" className="mb-1.5 block text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="order-search"
                  type="search"
                  placeholder="Order ID or product"
                  value={filters.q}
                  onChange={(e) => set("q", e.target.value)}
                  className={`bg-surface-1 pl-9 ${filters.q ? "border-primary/60" : ""}`}
                />
              </div>
            </div>
            <FilterSelect id="f-risk" label="Risk level" active={filters.risk !== DEFAULT_FILTERS.risk} value={filters.risk} onChange={(v) => set("risk", v as OrderFilters["risk"])}
              options={RISK_FILTERS.map((r) => ({ value: r, label: riskFilterLabel[r] }))} />
            <FilterSelect id="f-delivery" label="Delivery status" active={filters.delivery !== DEFAULT_FILTERS.delivery} value={filters.delivery} onChange={(v) => set("delivery", v as OrderFilters["delivery"])}
              options={[{ value: "all", label: "All statuses" }, ...DELIVERY_STATUSES.map((d) => ({ value: d, label: deliveryLabel[d] }))]} />
            <FilterSelect id="f-install" label="Installation status" active={filters.installation !== DEFAULT_FILTERS.installation} value={filters.installation} onChange={(v) => set("installation", v as OrderFilters["installation"])}
              options={[{ value: "all", label: "All statuses" }, ...INSTALLATION_STATUSES.map((i) => ({ value: i, label: installLabel[i] }))]} />
            <FilterSelect id="f-sort" label="Sort by" active={filters.sort !== DEFAULT_FILTERS.sort} value={filters.sort} onChange={(v) => set("sort", v as OrderFilters["sort"])}
              options={SORT_OPTIONS.map((o) => ({ value: o, label: sortLabel[o] }))} />
            <Button variant="outline" onClick={reset} disabled={isDefault(filters)} className="w-full lg:w-auto">
              <RotateCcw /> Reset filters
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs" aria-live="polite">
            <span className="flex items-center gap-1.5 text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />{chips.length === 0 ? "No filters applied — showing all orders by highest rule score." : `${chips.length} applied:`}</span>
            {chips.map((c) => (
              <button key={c.key} type="button" onClick={() => set(c.key, DEFAULT_FILTERS[c.key])}
                className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-primary transition-colors hover:bg-primary/20"
                aria-label={`Remove filter ${c.label}`}>
                <span className="truncate">{c.label}</span><X className="h-3 w-3 shrink-0" aria-hidden />
              </button>
            ))}
          </div>
        </div>

        <Section
          tone="rule"
          title="Orders"
          description="Rule score is a 0–100 priority score from illustrative operational rules — not a probability of delay or a trained model prediction."
          badge={
            <span className="font-mono text-xs text-muted-foreground" aria-live="polite">
              {visible.length} of {all.length} orders
            </span>
          }
        >
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-1 px-6 py-10 text-center">
              <SearchX className="h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">No orders match these filters</p>
              <p className="mt-1 text-xs text-muted-foreground">Try a different search or clear the filters.</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={reset}>
                <RotateCcw /> Clear filters
              </Button>
            </div>
          ) : (
            <OrderTable orders={visible} from="orders" showScore caption="Filtered orders" />
          )}
        </Section>
      </PageBody>
    </>
  );
}
