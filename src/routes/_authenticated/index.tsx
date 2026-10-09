import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Info, RefreshCw, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { OrderTable } from "@/components/orders/OrderTable";
import { PageHeader, PageBody, Section, EmptyState } from "@/components/layout/Page";
import { RiskBadge } from "@/components/RiskBadge";
import { getDemoOrders } from "@/data/demo-orders";
import { useInterventions } from "@/components/interventions/InterventionsProvider";
import { assessAll, groupInterventions, prioritize, summarize, RISK_THRESHOLDS } from "@/lib/risk";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — SYNOVA AI" },
      { name: "description", content: "Overview of order risk, interventions and fulfillment health." },
      { property: "og:title", content: "Operations Dashboard — SYNOVA AI" },
      { property: "og:description", content: "Know the delay before it happens." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [now, setNow] = useState(() => new Date());
  const [refreshedLabel, setRefreshedLabel] = useState<string | null>(null);

  useEffect(() => {
    setRefreshedLabel(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
  }, [now]);

  const orders = useMemo(() => prioritize(assessAll(getDemoOrders(now), now)), [now]);
  const s = useMemo(() => summarize(orders), [orders]);
  const { interventions: interventionList } = useInterventions();
  const interventions = groupInterventions(interventionList);
  const priority = orders.filter((o) => o.assessment.level !== "low").slice(0, 8);

  const kpis = [
    { label: "Total Orders", value: s.total, hint: "Orders in the demo dataset", href: "#priority-orders" },
    { label: "At-Risk Orders", value: s.atRisk, hint: "High or medium rule-based risk", href: "#priority-orders" },
    { label: "Delivery Delays", value: s.deliveryDelays, hint: "Past promised date, not yet delivered", href: "#priority-orders" },
    { label: "Installations Pending", value: s.fulfillment.awaitingInstallation, hint: "Delivered, installation not completed", href: "#fulfillment" },
  ];

  const dist = [
    { level: "high" as const, count: s.risk.high, bar: "bg-destructive" },
    { level: "medium" as const, count: s.risk.medium, bar: "bg-warning" },
    { level: "low" as const, count: s.risk.low, bar: "bg-success" },
  ];

  const stages = [
    { label: "Fully completed", value: s.fulfillment.completed, note: "Delivered and, where required, installed" },
    { label: "Delivered, awaiting installation", value: s.fulfillment.awaitingInstallation, note: "Delivered doesn't mean completed" },
    { label: "Awaiting delivery", value: s.fulfillment.awaitingDelivery, note: "Not yet delivered" },
  ];

  return (
    <>
      <PageHeader
        title="Operations Dashboard"
        description="Predict, explain and prevent delivery, installation and fulfillment delays before customers are affected."
        actions={
          <>
            <Badge variant="info" className="gap-1.5">
              <FlaskConical className="h-3 w-3" aria-hidden /> Illustrative demo data
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNow(new Date())}
              aria-label="Recalculate dashboard from demo data"
              title="Recalculates risk and summaries from the local demo dataset. No live data is fetched."
            >
              <RefreshCw /> Refresh
            </Button>
          </>
        }
      />
      <PageBody>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {refreshedLabel ? `Last recalculated ${refreshedLabel} · local demo dataset, no live data source` : "\u00a0"}
        </p>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Order KPIs">
          {kpis.map((k) => (
            <li key={k.label}>
              <a
                href={k.href}
                aria-label={`${k.label}: ${k.value}. ${k.hint}`}
                className="group relative block h-full overflow-hidden rounded-lg border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-primary/50 hover:bg-surface-2"
              >
                <span aria-hidden className={`absolute inset-y-0 left-0 w-0.5 ${k.label === "At-Risk Orders" ? "bg-destructive/80" : "bg-primary/0 group-hover:bg-primary/60"}`} />
                <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
                <p className="mt-2 font-mono text-[2rem] font-medium leading-none tracking-tight text-foreground tabular">{k.value}</p>
                <p className="mt-3 text-xs text-muted-foreground">{k.hint}</p>
              </a>
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Section
            id="priority-orders"
            className="xl:col-span-2"
            tone="rule"
            title="Priority orders"
            description="Highest rule-based risk score first. Select an order to see why it was flagged."
          >
            {priority.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders currently flagged.</p>
            ) : (
              <OrderTable orders={priority} from="dashboard" caption="Priority orders" />
            )}
          </Section>

          <Section title="Risk overview" description={`Distribution across all ${s.total} orders.`}>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              {dist.map((d) => (
                <div key={d.level} className={d.bar} style={{ width: `${(d.count / s.total) * 100}%` }} />
              ))}
            </div>
            <ul className="mt-5 divide-y divide-border">
              {dist.map((d) => (
                <li key={d.level} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                  <RiskBadge level={d.level} />
                  <span className="font-mono text-sm">
                    {d.count} <span className="text-muted-foreground">/ {s.total}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Section title="Interventions" description="Shared demo records for the Intervention Center.">
            {interventionList.length === 0 ? (
              <EmptyState icon={Wrench} title="No interventions yet" description="Recommendations will appear here when risks are detected." />
            ) : (
              <ul className="space-y-4">
                {([
                  ["open", "Open"],
                  ["in_progress", "In progress"],
                  ["completed", "Recently completed"],
                ] as const).map(([key, label]) => (
                  <li key={key}>
                    <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      <span>{label}</span>
                      <span className="font-mono">{interventions[key].length}</span>
                    </div>
                    {interventions[key].length > 0 ? (
                      <ul className="mt-1.5 space-y-1">
                        {interventions[key].map((i) => (
                          <li key={i.id} className="text-sm">
                            <span className="font-mono text-xs text-muted-foreground">{i.orderId}</span> · {i.action}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1.5 text-xs text-muted-foreground">None</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="fulfillment" title="Fulfillment completeness" description="Delivery and installation tracked as separate stages.">
            <ul className="space-y-4">
              {stages.map((st) => (
                <li key={st.label} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm">{st.label}</p>
                    <p className="text-xs text-muted-foreground">{st.note}</p>
                  </div>
                  <span className="font-mono text-xl tabular">{st.value}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Prediction quality" description="How risk is assessed in this prototype.">
            <div className="flex gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Risk labels come from transparent, illustrative operational rules — not a trained or validated predictive model.
                </p>
                <p>
                  Scores are rule-based priority points (0–100; high ≥ {RISK_THRESHOLDS.high}, medium ≥ {RISK_THRESHOLDS.medium}). A score is not a probability of delay.
                </p>
                <p>Measuring predictive accuracy requires historical outcome data, which is not yet available.</p>
              </div>
            </div>
          </Section>
        </div>
      </PageBody>

    </>
  );
}
