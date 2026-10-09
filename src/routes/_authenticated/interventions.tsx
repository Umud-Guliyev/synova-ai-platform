import { Link, createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, CircleDot, Circle, FlaskConical, Inbox, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PageBody, PageHeader } from "@/components/layout/Page";
import { RiskBadge } from "@/components/RiskBadge";
import { useInterventions } from "@/components/interventions/InterventionsProvider";
import { getDemoOrders, type Intervention, type InterventionStatus } from "@/data/demo-orders";
import { INTERVENTION_STATUSES, countByStatus, statusLabel } from "@/lib/interventions";
import { assessAll, findOrder, type AssessedOrder } from "@/lib/risk";

const DESCRIPTION = "Turn delivery and installation risks into trackable operational actions.";

export const Route = createFileRoute("/_authenticated/interventions")({
  head: () => ({
    meta: [
      { title: "Intervention Center — SYNOVA AI" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Intervention Center — SYNOVA AI" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: InterventionCenter,
});

const statusIcon: Record<InterventionStatus, typeof Circle> = { open: Circle, in_progress: CircleDot, completed: CheckCircle2 };
const statusTone: Record<InterventionStatus, string> = { open: "text-warning", in_progress: "text-primary", completed: "text-success" };
const statusEdge: Record<InterventionStatus, string> = { open: "bg-warning", in_progress: "bg-primary", completed: "bg-success/60" };
const statusHint: Record<InterventionStatus, string> = { open: "Needs an owner", in_progress: "Being worked on", completed: "Marked done in this session" };

function InterventionCard({ item, order }: { item: Intervention; order: AssessedOrder | undefined }) {
  const { updateStatus } = useInterventions();
  const factor = order?.assessment.factors.find((f) => f.code === item.factorCode);
  const selectId = `status-${item.id}`;
  return (
    <li className={`relative overflow-hidden rounded-md border border-border bg-surface-1 p-4 pl-5 ${item.status === "completed" ? "opacity-85" : ""}`}>
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${statusEdge[item.status]}`} />
      <div className="flex items-start justify-between gap-3">
        <p className={`min-w-0 text-sm font-medium ${item.status === "completed" ? "text-muted-foreground" : ""}`}>{item.action}</p>
        <span className="shrink-0 font-mono text-[11px] text-muted-foreground">{item.id}</span>
      </div>
      <dl className="mt-3 space-y-2 text-xs">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <dt className="text-muted-foreground">Order</dt>
          <dd>
            {order ? (
              <Link
                to="/orders/$orderId"
                params={{ orderId: order.id }}
                className="rounded font-mono text-primary underline decoration-primary/40 underline-offset-4 hover:decoration-primary"
              >
                {order.id}
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1 font-mono text-muted-foreground">
                <AlertTriangle className="h-3 w-3" aria-hidden /> {item.orderId} (order not found)
              </span>
            )}
          </dd>
          {order && <dd><RiskBadge level={order.assessment.level} /></dd>}
        </div>
        <div>
          <dt className="sr-only">Reason</dt>
          <dd className="rounded bg-background/40 px-2 py-1.5 text-muted-foreground">
            <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Reason</span>
            {factor ? factor.description : item.factorCode ? "Linked risk factor no longer flagged by current rules" : "No linked risk factor recorded"}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        {item.origin === "demo_ui" ? (
          <Badge variant="info">Created in demo</Badge>
        ) : (
          <span className="text-[11px] text-muted-foreground">Seed demo record</span>
        )}
        <div className="flex items-center gap-2">
          <label htmlFor={selectId} className="text-xs text-muted-foreground">Set status</label>
          <select
            id={selectId}
            value={item.status}
            onChange={(e) => updateStatus(item.id, e.target.value)}
            aria-label={`Status for ${item.id}`}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {INTERVENTION_STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabel[s]}</option>
            ))}
          </select>
        </div>
      </div>
    </li>
  );
}

function InterventionCenter() {
  const { interventions } = useInterventions();
  const orders = useMemo(() => assessAll(getDemoOrders()), []);
  const counts = countByStatus(interventions);

  return (
    <>
      <PageHeader
        title="Intervention Center"
        description={DESCRIPTION}
        actions={
          <Badge variant="info" className="gap-1.5">
            <FlaskConical className="h-3 w-3" aria-hidden /> Illustrative demo data
          </Badge>
        }
      />
      <PageBody>
        <ul className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Intervention counts">
          {INTERVENTION_STATUSES.map((s) => {
            const Icon = statusIcon[s];
            return (
              <li key={s} className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)] sm:p-4" aria-label={`${statusLabel[s]}: ${counts[s]}`}>
                <span aria-hidden className={`absolute inset-x-0 top-0 h-0.5 ${statusEdge[s]}`} />
                <p className="flex min-w-0 items-start gap-1.5 text-[11px] font-medium uppercase tracking-wide sm:tracking-wider text-muted-foreground sm:gap-2">
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${statusTone[s]}`} aria-hidden /> <span className="leading-tight">{statusLabel[s]}</span>
                </p>
                <p className="mt-2 font-mono text-2xl tabular">{counts[s]}</p>
                <p className="mt-1 hidden text-xs text-muted-foreground sm:block">{statusHint[s]}</p>
              </li>
            );
          })}
        </ul>

        <p className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <RotateCcw className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
          <span><span className="font-medium text-foreground">Session-only.</span> Status changes and new interventions are demo-state only. Nothing is sent to an external logistics system, and changes reset when the page is reloaded. Create new interventions from an order's risk analysis on its Order Details page.</span>
        </p>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {INTERVENTION_STATUSES.map((s) => {
            const items = interventions.filter((i) => i.status === s);
            return (
              <section key={s} aria-labelledby={`col-${s}`} className="rounded-lg border border-border bg-card shadow-[var(--shadow-card)]">
                <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                  <h2 id={`col-${s}`} className="flex items-center gap-2 text-[0.9375rem] font-semibold">
                    {(() => { const I = statusIcon[s]; return <I className={`h-4 w-4 ${statusTone[s]}`} aria-hidden />; })()}
                    {statusLabel[s]}
                  </h2>
                  <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="p-4">
                  {items.length === 0 ? (
                    <div className="flex flex-col items-center rounded-md border border-dashed border-border px-4 py-8 text-center">
                      <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
                      <p className="mt-2 text-xs font-medium text-foreground">No {statusLabel[s].toLowerCase()} interventions</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{s === "open" ? "Create one from an order’s risk analysis." : "Change a card’s status to move it here."}</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {items.map((i) => (
                        <InterventionCard key={i.id} item={i} order={findOrder(orders, i.orderId)} />
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
