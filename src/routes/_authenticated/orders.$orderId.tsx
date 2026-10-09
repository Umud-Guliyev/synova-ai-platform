import { Link, createFileRoute, notFound, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useMemo } from "react";
import { ArrowLeft, CheckCircle2, Circle, CircleDot, FlaskConical, Lightbulb, MinusCircle, SearchX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageBody, PageHeader, Section } from "@/components/layout/Page";
import { MlPredictionSection } from "@/components/orders/MlPredictionSection";
import { RiskBadge } from "@/components/RiskBadge";
import { fmtDate } from "@/components/orders/OrderTable";
import { getDemoOrders } from "@/data/demo-orders";
import { useInterventions } from "@/components/interventions/InterventionsProvider";
import { findActive, statusLabel } from "@/lib/interventions";
import { DEFAULT_FILTERS, deliveryLabel, installLabel } from "@/lib/order-filters";
import {
  FACTOR_MEANING, RISK_THRESHOLDS, assessAll, findOrder, orderTimeline, recommendations,
  type FulfillmentStage, type StageState,
} from "@/lib/risk";

type From = "dashboard" | "orders";

export const Route = createFileRoute("/_authenticated/orders/$orderId")({
  validateSearch: (s: { from?: unknown }): { from?: From } =>
    s.from === "dashboard" || s.from === "orders" ? { from: s.from } : {},
  loader: ({ params }) => {
    const order = getDemoOrders().find((o) => o.id.toLowerCase() === params.orderId.toLowerCase());
    if (!order) throw notFound();
    return { id: order.id, product: order.product };
  },
  head: ({ loaderData }) =>
    loaderData
      ? {
          meta: [
            { title: `${loaderData.id} · ${loaderData.product} — SYNOVA AI` },
            { name: "description", content: "Rule-based risk analysis and fulfillment status for a synthetic demo order." },
            { property: "og:title", content: "Order details — SYNOVA AI" },
            { property: "og:description", content: "Order details and rule-based risk analysis." },
          ],
        }
      : { meta: [{ title: "Order not found — SYNOVA AI" }, { name: "robots", content: "noindex" }] },
  component: OrderDetails,
  notFoundComponent: OrderNotFound,
  errorComponent: ({ error }) => (
    <PageBody>
      <p role="alert" className="text-sm text-destructive">This order could not be loaded: {error instanceof Error ? error.message : "Unknown error"}</p>
    </PageBody>
  ),
});

function OrderNotFound() {
  return (
    <PageBody>
      <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-lg border border-dashed border-border bg-surface-1 px-6 py-12 text-center">
        <SearchX className="h-7 w-7 text-muted-foreground" aria-hidden />
        <h1 className="mt-4 text-lg font-semibold">Order not found</h1>
        <p className="mt-1 text-sm text-muted-foreground">No order with this ID exists in the demo dataset.</p>
        <Button asChild variant="outline" size="sm" className="mt-5">
          <Link to="/orders" search={DEFAULT_FILTERS}><ArrowLeft /> Back to Order Risk Monitor</Link>
        </Button>
      </div>
    </PageBody>
  );
}

function BackButton({ from }: { from: From | undefined }) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const label = from === "dashboard" ? "Back to dashboard" : "Back to Order Risk Monitor";
  if (from && canGoBack) {
    return (
      <Button variant="ghost" size="sm" onClick={() => router.history.back()}>
        <ArrowLeft /> {label}
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost" size="sm">
      {from === "dashboard" ? (
        <Link to="/"><ArrowLeft /> {label}</Link>
      ) : (
        <Link to="/orders" search={DEFAULT_FILTERS}><ArrowLeft /> {label}</Link>
      )}
    </Button>
  );
}

const stageIcon: Record<StageState, typeof Circle> = {
  completed: CheckCircle2,
  current: CircleDot,
  pending: Circle,
  not_applicable: MinusCircle,
};
const stageText: Record<StageState, string> = {
  completed: "Completed",
  current: "Current",
  pending: "Pending",
  not_applicable: "Not required",
};
const stageTone: Record<StageState, string> = {
  completed: "text-success",
  current: "text-primary",
  pending: "text-muted-foreground",
  not_applicable: "text-muted-foreground",
};
const fulfillmentText: Record<FulfillmentStage, { label: string; note: string }> = {
  completed: { label: "Fully completed", note: "Delivered and, where required, installed." },
  awaiting_installation: { label: "Delivered, awaiting installation", note: "Delivered doesn't mean completed — installation is still required." },
  awaiting_delivery: { label: "Awaiting delivery", note: "The order has not been delivered yet." },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}

function OrderDetails() {
  const { orderId } = Route.useParams();
  const { from } = Route.useSearch();
  const order = useMemo(() => findOrder(assessAll(getDemoOrders()), orderId), [orderId]);
  const { interventions, createFromFactor } = useInterventions();
  if (!order) return <OrderNotFound />;

  const a = order.assessment;
  const timeline = orderTimeline(order);
  const recs = recommendations(a);
  const fulfil = fulfillmentText[order.stage];

  return (
    <>
      <div className="px-4 pt-4 sm:px-6 lg:px-8">
        <BackButton from={from} />
      </div>
      <PageHeader
        title={order.id}
        description={order.product}
        actions={
          <>
            <RiskBadge level={a.level} />
            <Badge variant="muted" className="font-mono">Rule score {a.score}/100</Badge>
            <Badge variant="info" className="gap-1.5">
              <FlaskConical className="h-3 w-3" aria-hidden /> Illustrative demo data
            </Badge>
          </>
        }
      />
      <PageBody>
        <p className="text-xs text-muted-foreground">
          The rule score is a 0–100 priority score from illustrative operational rules (high ≥ {RISK_THRESHOLDS.high}, medium ≥ {RISK_THRESHOLDS.medium}). It is not a probability of delay and does not come from a trained ML model.
        </p>

        <Section title="Order overview">
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Expected delivery"><span className="font-mono">{fmtDate(order.expectedDelivery)}</span></Field>
            {order.deliveredOn && (
              <Field label="Delivered on"><span className="font-mono">{fmtDate(order.deliveredOn)}</span></Field>
            )}
            <Field label="Delivery status">{deliveryLabel[order.deliveryStatus]}</Field>
            <Field label="Installation required">{order.installationRequired ? "Yes" : "No"}</Field>
            <Field label="Installation status">{installLabel[order.installationStatus]}</Field>
            <Field label="Stock allocation">{order.stockConfirmed ? "Confirmed" : "Not confirmed"}</Field>
          </dl>
        </Section>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Section tone="rule" badge={<span className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Rule-based</span>} className="xl:col-span-2" title="Risk analysis" description="Factors identified by the current rules and what they mean operationally.">
            {a.factors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No risk factors are identified for this order by the current rules.</p>
            ) : (
              <ul className="space-y-4">
                {a.factors.map((f) => (
                  <li key={f.code} className="rounded-md border border-border bg-surface-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium">{f.description}</p>
                      <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-label={`Adds ${f.points} points`}>+{f.points} pts</span>
                    </div>
                    <p className="mt-1.5 text-sm text-muted-foreground">{FACTOR_MEANING[f.code]}</p>
                    {(() => {
                      const active = findActive(interventions, order.id, f.code);
                      return active ? (
                        <p className="mt-3 text-xs text-muted-foreground">
                          Intervention <span className="font-mono">{active.id}</span> is {statusLabel[active.status].toLowerCase()} ·{" "}
                          <Link to="/interventions" className="text-primary underline underline-offset-4">View in Intervention Center</Link>
                        </p>
                      ) : (
                        <Button variant="outline" size="sm" className="mt-3" onClick={() => createFromFactor(order.id, f)}>
                          Create demo intervention
                        </Button>
                      );
                    })()}
                  </li>
                ))}
                <li className="flex justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">Total rule score (capped at 100)</span>
                  <span className="font-mono">{a.score}/100</span>
                </li>
              </ul>
            )}
          </Section>

          <Section title="Fulfillment status" description="Delivery and installation are separate stages.">
            <p className="text-sm font-medium">{fulfil.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{fulfil.note}</p>
            <dl className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Delivery">{deliveryLabel[order.deliveryStatus]}</Field>
              <Field label="Installation">{installLabel[order.installationStatus]}</Field>
            </dl>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Section title="Order timeline" description="Lifecycle stages based only on what the order record contains.">
            <ol className="space-y-4">
              {timeline.map((t) => {
                const Icon = stageIcon[t.state];
                return (
                  <li key={t.key} className="flex items-start gap-3">
                    <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${stageTone[t.state]}`} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{t.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {stageText[t.state]}
                        {t.state !== "not_applicable" && (
                          <> · {t.date ? <span className="font-mono">{fmtDate(t.date)}</span> : "Date not recorded"}</>
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Section>

          <Section title="Recommended actions" description="Suggestions derived from the risk factors. None have been performed in the real world.">
            {recs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No additional action is suggested by the current rules.</p>
            ) : (
              <ul className="space-y-3">
                {recs.map((r) => (
                  <li key={r} className="flex items-start gap-3 text-sm">
                    <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span><span className="sr-only">Suggestion: </span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <MlPredictionSection key={order.id} order={order} />
      </PageBody>
    </>
  );
}
