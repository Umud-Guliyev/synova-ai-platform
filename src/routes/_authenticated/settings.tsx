import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, CheckCircle2, FlaskConical, Loader2, UserRound, XCircle } from "lucide-react";
import { PageHeader, PageBody, Section } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { isDemoUser } from "@/lib/auth";
import { checkHealth, MlApiError } from "@/lib/ml-api";
import { DEFAULT_THRESHOLDS } from "@/ml/schema";

const DESCRIPTION = "Your account, the prediction service status and how the demo data and delay rules are defined.";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — SYNOVA AI" },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: "Settings — SYNOVA AI" },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: Page,
});

type Health =
  | { s: "idle" }
  | { s: "loading" }
  | { s: "ok"; status: string; delivery: boolean; installation: boolean; checkedAt: Date }
  | { s: "error"; message: string };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground sm:text-right">{children}</dd>
    </div>
  );
}

function ModelState({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1.5 text-success"><CheckCircle2 className="h-4 w-4" aria-hidden /> Loaded</span>
  ) : (
    <span className="inline-flex items-center gap-1.5 text-destructive"><XCircle className="h-4 w-4" aria-hidden /> Not loaded</span>
  );
}

function Page() {
  const { user } = Route.useRouteContext();
  const demo = isDemoUser(user);
  const [health, setHealth] = useState<Health>({ s: "idle" });

  async function runCheck() {
    setHealth({ s: "loading" });
    try {
      const h = await checkHealth();
      setHealth({ s: "ok", status: h.status, delivery: h.deliveryModelLoaded, installation: h.installationModelLoaded, checkedAt: new Date() });
    } catch (e) {
      setHealth({ s: "error", message: e instanceof MlApiError ? e.message : "The status check failed." });
    }
  }

  return (
    <>
      <PageHeader title="Settings" description={DESCRIPTION} />
      <PageBody>
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Account" description="Who is signed in to this session.">
            <dl>
              <Row label="Signed in as">
                <span className="inline-flex items-center gap-1.5">
                  {demo ? <FlaskConical className="h-4 w-4 text-primary" aria-hidden /> : <UserRound className="h-4 w-4 text-primary" aria-hidden />}
                  {demo ? "Demo guest session" : (user.email ?? "Account")}
                </span>
              </Row>
              <Row label="Account type">{demo ? "Guest (no email)" : "Email and password"}</Row>
            </dl>
            {demo && (
              <p className="mt-4 text-sm text-muted-foreground">
                Guest sessions are for exploring the demo.{" "}
                <Link to="/register" className="font-medium text-primary underline-offset-4 hover:underline">Create an account</Link>{" "}
                to use your own email.
              </p>
            )}
          </Section>

          <Section title="Prediction service" tone="ml" description="Checks the experimental ML service only when you press the button.">
            <dl>
              <Row label="Service">{health.s === "ok" ? health.status : health.s === "error" ? "Unavailable" : "Not checked"}</Row>
              <Row label="Delivery model">{health.s === "ok" ? <ModelState ok={health.delivery} /> : "—"}</Row>
              <Row label="Installation model">{health.s === "ok" ? <ModelState ok={health.installation} /> : "—"}</Row>
            </dl>
            {health.s === "error" && (
              <p role="alert" className="mt-3 text-sm text-destructive">{health.message} It may be waking up — try again in a moment.</p>
            )}
            {health.s === "ok" && (
              <p className="mt-3 text-xs text-muted-foreground">Checked at {health.checkedAt.toLocaleTimeString()}.</p>
            )}
            <Button className="mt-4" variant="outline" onClick={runCheck} disabled={health.s === "loading"}>
              {health.s === "loading" ? <Loader2 className="animate-spin" aria-hidden /> : <Activity aria-hidden />}
              {health.s === "loading" ? "Checking…" : "Check service status"}
            </Button>
          </Section>

          <Section title="Data & delay rules" description="Read-only. These definitions are fixed for the demo." className="lg:col-span-2">
            <dl>
              <Row label="Order data">Synthetic demo orders only — not real customers</Row>
              <Row label="Model training data">Synthetic dataset only; scores are not validated real-world probabilities</Row>
              <Row label="Delivery counted as delayed">More than {DEFAULT_THRESHOLDS.deliveryGraceHours} hours after the promised date</Row>
              <Row label="Installation counted as delayed">More than {DEFAULT_THRESHOLDS.installationWindowHours} hours after delivery</Row>
              <Row label="Intervention changes">Kept for this session only; reset when the page reloads</Row>
            </dl>
          </Section>
        </div>
      </PageBody>
    </>
  );
}
