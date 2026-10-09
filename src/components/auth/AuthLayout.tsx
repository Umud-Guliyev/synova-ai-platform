import logo from "@/assets/synova-logo.png.asset.json";
import type { ReactNode } from "react";
import { FlaskConical } from "lucide-react";

export function AuthLayout({ title, description, children, footer }: { title: string; description: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <main id="main" className="flex min-h-screen items-center justify-center bg-background bg-[radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent)] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex items-center gap-2.5">
          <img src={logo.url} alt="" aria-hidden className="h-10 w-10 rounded-md object-contain dark:bg-foreground dark:p-0.5" />
          <div>
            <p className="font-display text-sm font-semibold tracking-wide">SYNOVA AI</p>
            <p className="text-xs text-muted-foreground">Know the delay before it happens.</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 text-center text-sm text-muted-foreground">{footer}</div>}
        <p className="mt-6 flex items-start justify-center gap-2 text-center text-xs text-muted-foreground">
          <FlaskConical className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          All orders in this prototype are illustrative synthetic data. No real customers or retailers.
        </p>
      </div>
    </main>
  );
}
