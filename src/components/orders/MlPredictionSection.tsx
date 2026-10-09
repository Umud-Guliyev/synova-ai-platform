import { useState } from "react";
import { AlertTriangle, CircleDashed, FlaskConical, Loader2, MinusCircle, Play, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/layout/Page";
import type { Order } from "@/data/demo-orders";
import {
  FEATURE_SOURCES, MlApiError, mapOrderToFeatures, predictDelivery, predictInstallation, shouldPredictInstallation,
  type MlFeatures, type Prediction,
} from "@/lib/ml-api";

const FEATURE_KEYS = Object.keys(FEATURE_SOURCES) as (keyof MlFeatures)[];

type State = { status: "idle" } | { status: "loading" } | { status: "done"; value: Prediction } | { status: "error"; message: string };

const errorText = (e: unknown) =>
  e instanceof MlApiError
    ? e.kind === "invalid_response" ? `Unexpected response from the ML service: ${e.message}` : e.message
    : "The prediction failed unexpectedly.";

const pretty = (s: string) => s.replace(/_/g, " ");

function Result({ title, state, onRetry }: { title: string; state: State; onRetry: () => void }) {
  return (
    <div className={`rounded-md border bg-surface-1 p-4 ${state.status === "error" ? "border-destructive/40" : state.status === "done" ? "border-ml/30" : "border-border"}`} aria-live="polite" aria-busy={state.status === "loading"}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <span className="text-[11px] text-muted-foreground">{state.status === "idle" ? "Not run" : state.status === "loading" ? "Running" : state.status === "error" ? "Failed" : "Experimental score"}</span>
      </div>
      {state.status === "idle" && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <CircleDashed className="h-3.5 w-3.5 shrink-0" aria-hidden /> Not run yet. Use “Run ML prediction” to request a score.
        </p>
      )}
      {state.status === "loading" && (
        <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Requesting prediction… the service may take up to a minute to wake up.
        </p>
      )}
      {state.status === "error" && (
        <div className="mt-2 space-y-2">
          <p role="alert" className="flex items-start gap-2 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {state.message}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}><RotateCcw /> Retry</Button>
        </div>
      )}
      {state.status === "done" && (
        <div className="mt-2 space-y-2">
          <p className="text-sm">Predicted label: <span className="font-medium capitalize text-ml">{pretty(state.value.predictedLabel)}</span></p>
          <dl className="space-y-1.5">
            {Object.entries(state.value.modelScores).map(([k, v]) => (
              <div key={k} className="text-xs">
                <div className="flex justify-between gap-2">
                  <dt className="capitalize text-muted-foreground">{pretty(k)} model score</dt>
                  <dd className="font-mono tabular">{v.toFixed(4)}</dd>
                </div>
                <div aria-hidden className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-ml/60" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
                </div>
              </div>
            ))}
          </dl>
          <p className="text-[11px] text-muted-foreground">Synthetic-data model score — not a validated real-world probability.</p>
          {state.value.scoreNote && <p className="text-xs text-muted-foreground">{state.value.scoreNote}</p>}
        </div>
      )}
    </div>
  );
}

export function MlPredictionSection({ order }: { order: Order }) {
  const [delivery, setDelivery] = useState<State>({ status: "idle" });
  const [install, setInstall] = useState<State>({ status: "idle" });
  const mapping = mapOrderToFeatures(order);

  const run = async (which: "delivery" | "installation" | "both") => {
    if (!mapping.ok) return;
    const f = mapping.features;
    const jobs: Promise<void>[] = [];
    if (which !== "installation") {
      setDelivery({ status: "loading" });
      jobs.push(predictDelivery(f).then((value) => setDelivery({ status: "done", value }), (e) => setDelivery({ status: "error", message: errorText(e) })));
    }
    if (which !== "delivery" && shouldPredictInstallation(f)) {
      setInstall({ status: "loading" });
      jobs.push(predictInstallation(f).then((value) => setInstall({ status: "done", value }), (e) => setInstall({ status: "error", message: errorText(e) })));
    }
    await Promise.all(jobs);
  };

  const busy = delivery.status === "loading" || install.status === "loading";

  return (
    <Section
      tone="ml"
      badge={<span className="rounded border border-ml/30 bg-ml/10 px-2 py-0.5 text-[11px] font-medium text-ml">Model score · synthetic</span>}
      title="ML prediction (experimental)"
      description="Separate from the rule score above. Runs only when you ask."
    >
      <p className="mb-4 flex items-start gap-2 rounded-md border border-ml/20 bg-ml/5 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
        <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ml" aria-hidden />
        Predictions come from a prototype model trained on synthetic data only. Model scores are not validated real-world probabilities and do not prove operational accuracy.
      </p>
      {!mapping.ok ? (
        <div className="rounded-md border border-dashed border-warning/40 bg-warning/5 p-4">
          <p className="flex items-center gap-2 text-sm font-medium"><MinusCircle className="h-4 w-4 shrink-0 text-warning" aria-hidden /> A prediction can't be run for this order</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {mapping.reasons.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border border-border p-4">
            <p className="text-sm font-medium">Model inputs</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Values marked “Synthetic demo input” were invented for this demo. They are not real attributes of this order.
            </p>
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-2">
              {FEATURE_KEYS.map((k) => (
                <div key={k} className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-border/60 pb-2 text-xs">
                  <dt className="min-w-0 break-all text-muted-foreground">{k}</dt>
                  <dd className="text-right">
                    <span className="font-mono">{String(mapping.features[k])}</span>{" "}
                    <Badge variant={FEATURE_SOURCES[k] === "synthetic_demo" ? "info" : "muted"} className="ml-1">
                      {FEATURE_SOURCES[k] === "synthetic_demo" ? "Synthetic demo input" : "From order record"}
                    </Badge>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" onClick={() => run("both")} disabled={busy} aria-describedby="ml-run-note">
              {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />} {busy ? "Running prediction…" : "Run ML prediction"}
            </Button>
            <p id="ml-run-note" className="text-xs text-muted-foreground">Nothing is requested until you press this button.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Result title="Delivery delay" state={delivery} onRetry={() => run("delivery")} />
            {mapping.features.installationRequired ? (
              <Result title="Installation delay" state={install} onRetry={() => run("installation")} />
            ) : (
              <div className="rounded-md border border-border bg-surface-1 p-4">
                <p className="text-sm font-medium">Installation delay</p>
                <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><MinusCircle className="h-3.5 w-3.5 shrink-0" aria-hidden /> Not applicable — this order has no installation, so no request is sent.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}
