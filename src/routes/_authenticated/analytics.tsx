import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { FlaskConical, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader, Section } from "@/components/layout/Page";
import { RiskBadge } from "@/components/RiskBadge";
import { Distribution, type DistItem } from "@/components/analytics/Distribution";
import { useInterventions } from "@/components/interventions/InterventionsProvider";
import { getDemoOrders } from "@/data/demo-orders";
import { deliveryLabel, installLabel, DELIVERY_STATUSES, INSTALLATION_STATUSES } from "@/lib/order-filters";
import { INTERVENTION_STATUSES, countByStatus, statusLabel } from "@/lib/interventions";
import { FACTOR_MEANING, RISK_THRESHOLDS, RULE_SIGNALS, assessAll, statusDistribution, summarize } from "@/lib/risk";

const DESCRIPTION = "Monitor operational risk signals, fulfillment progress, and the quality of prediction methods.";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({
    meta: [
      { title: "AI Quality & Analytics — SYNOVA AI" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "AI Quality & Analytics — SYNOVA AI" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Analytics,
});

const shades = ["bg-primary", "bg-primary/60", "bg-primary/35", "bg-muted-foreground/40"];

const READINESS = [
  ["Historical outcomes", "Past orders with known, confirmed delivery and installation outcomes."],
  ["Prediction-time snapshots", "Timestamped records of what was known about each order when a prediction would have been made."],
  ["Defined labels", "Clear definitions of a delivery delay and an installation delay (e.g. how late counts as delayed)."],
  ["Time-aware splits", "Training on earlier periods and evaluating on later ones, so the model never sees the future."],
  ["Evaluation metrics", "Precision, recall, F1 and a confusion matrix — only once real outcomes and model predictions exist."],
] as const;

function Analytics() {
  const orders = useMemo(() => assessAll(getDemoOrders()), []);
  const { interventions } = useInterventions();
  const s = summarize(orders);
  const st = statusDistribution(orders);
  const ic = countByStatus(interventions);

  const kpis = [
    { label: "Total orders", value: s.total },
    { label: "At-risk orders", value: s.atRisk, hint: "High or medium" },
    { label: "Fully completed", value: s.fulfillment.completed, hint: "Delivered and, where required, installed" },
    { label: "Interventions", value: interventions.length, hint: "Current session" },
  ];

  const riskItems: DistItem[] = [
    { key: "high", label: <RiskBadge level="high" />, text: "High risk", value: s.risk.high, barClass: "bg-destructive" },
    { key: "medium", label: <RiskBadge level="medium" />, text: "Medium risk", value: s.risk.medium, barClass: "bg-warning" },
    { key: "low", label: <RiskBadge level="low" />, text: "On track", value: s.risk.low, barClass: "bg-success" },
  ];
  const deliveryItems: DistItem[] = DELIVERY_STATUSES.map((d, i) => ({ key: d, label: deliveryLabel[d], text: deliveryLabel[d], value: st.delivery[d], barClass: shades[i]! }));
  const installItems: DistItem[] = INSTALLATION_STATUSES.map((d, i) => ({ key: d, label: installLabel[d], text: installLabel[d], value: st.installation[d], barClass: shades[i]! }));
  const fulfilItems: DistItem[] = [
    { key: "completed", label: "Fully completed", text: "Fully completed", value: s.fulfillment.completed, barClass: "bg-success" },
    { key: "awaiting_installation", label: "Delivered, awaiting installation", text: "Delivered, awaiting installation", value: s.fulfillment.awaitingInstallation, barClass: "bg-warning" },
    { key: "awaiting_delivery", label: "Awaiting delivery", text: "Awaiting delivery", value: s.fulfillment.awaitingDelivery, barClass: "bg-muted-foreground/40" },
  ];
  const intItems: DistItem[] = INTERVENTION_STATUSES.map((k, i) => ({ key: k, label: statusLabel[k], text: statusLabel[k], value: ic[k], barClass: shades[i]! }));

  return (
    <>
      <PageHeader
        title="AI Quality & Analytics"
        description={DESCRIPTION}
        actions={
          <>
            <Badge variant="warning">Rule-based scoring · no trained ML model</Badge>
            <Badge variant="info" className="gap-1.5">
              <FlaskConical className="h-3 w-3" aria-hidden /> Illustrative demo data
            </Badge>
          </>
        }
      />
      <PageBody>
        <p className="flex items-start gap-2 rounded-md border border-border bg-surface-1 px-4 py-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          This prototype uses illustrative, rule-based risk scoring. It is not a trained or validated machine-learning model, and no prediction accuracy has been measured.
        </p>

        <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Operational overview">
          {kpis.map((k) => (
            <li key={k.label} className="rounded-lg border border-border bg-card p-4 shadow-[var(--shadow-card)]" aria-label={`${k.label}: ${k.value}`}>
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{k.label}</p>
              <p className="mt-2 font-mono text-2xl tabular">{k.value}</p>
              {k.hint && <p className="mt-1 text-xs text-muted-foreground">{k.hint}</p>}
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <h2 className="text-base font-semibold">Current synthetic-data summaries</h2>
          <span className="text-xs text-muted-foreground">Counts from demo records · not model evaluation</span>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          <Section title="Risk distribution" description="Operational fact: current rule output per order.">
            <Distribution items={riskItems} total={s.total} label="Orders by risk level" />
          </Section>
          <Section title="Delivery status" description="Operational fact from order records.">
            <Distribution items={deliveryItems} total={s.total} label="Orders by delivery status" />
          </Section>
          <Section title="Installation status" description="Operational fact from order records.">
            <Distribution items={installItems} total={s.total} label="Orders by installation status" />
          </Section>
          <Section title="Fulfillment completion" description="Delivery and required installation are separate stages; delivered ≠ completed.">
            <Distribution items={fulfilItems} total={s.total} label="Orders by fulfillment stage" />
          </Section>
          <Section title="Intervention status" description="Same in-session records as the Intervention Center.">
            <Distribution items={intItems} total={interventions.length} label="Interventions by status" />
          </Section>
        </div>

        <Section tone="rule" title="Rule-based risk quality" description="How the current risk engine works — and what it does not claim.">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>Scores are the sum of points from transparent, illustrative rules, capped at 100. High ≥ {RISK_THRESHOLDS.high}, medium ≥ {RISK_THRESHOLDS.medium}.</p>
              <p>A score out of 100 is a priority indicator, not a probability of delay. Risk levels are not measured model accuracy.</p>
              <p className="pt-2 text-foreground">
                Currently: <span className="font-mono">{s.risk.high}</span> high, <span className="font-mono">{s.risk.medium}</span> medium, <span className="font-mono">{s.risk.low}</span> on track.
              </p>
            </div>
            <ul className="space-y-4">
              {RULE_SIGNALS.map((g) => (
                <li key={g.category}>
                  <p className="text-sm font-medium">{g.label}</p>
                  <ul className="mt-1 space-y-1 text-xs text-muted-foreground">
                    {g.codes.map((c) => <li key={c}>· {FACTOR_MEANING[c]}</li>)}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </Section>

        <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2">
          <h2 className="text-base font-semibold">Model evaluation &amp; impact</h2>
          <span className="text-xs text-muted-foreground">Not yet measured</span>
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="ML evaluation readiness" description="Future requirements — these are not current model results." badge={<Badge variant="muted">Not yet available</Badge>}>
            <ol className="space-y-3">
              {READINESS.map(([t, d], i) => (
                <li key={t} className="flex gap-3 text-sm">
                  <span className="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                  <span><span className="font-medium">{t}.</span> <span className="text-muted-foreground">{d}</span></span>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Intervention analytics" description="Status tracking only — no outcome attribution.">
            <ul className="space-y-3 text-sm">
              <li><span className="font-medium">Created</span> <span className="text-muted-foreground">— an intervention record exists for an order and risk reason.</span></li>
              <li><span className="font-medium">Marked completed</span> <span className="text-muted-foreground">— someone set its status to Completed in this demo.</span></li>
              <li><span className="font-medium">Outcome confirmed</span> <span className="text-muted-foreground">— the order's delivery or installation is recorded as done in the order data.</span></li>
            </ul>
            <p className="mt-4 rounded-md border border-dashed border-border bg-surface-1 px-3 py-2 text-xs text-muted-foreground">
              A completed intervention does not mean a delay was prevented. Verified intervention impact is not yet measured, because interventions have no outcome tracking.
            </p>
          </Section>
        </div>
      </PageBody>
    </>
  );
}
