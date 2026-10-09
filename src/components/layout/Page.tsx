import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="border-b border-border px-4 pb-5 pt-6 sm:px-6 lg:px-8 lg:pt-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">{title}</h1>
          {description && <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}

export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6 lg:px-8", className)}>{children}</div>;
}

export function Section({
  title,
  description,
  children,
  className,
  badge,
  id,
  tone = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  badge?: ReactNode;
  id?: string;
  /** "rule" marks rule-based output, "ml" marks synthetic-data model output. */
  tone?: "default" | "rule" | "ml";
}) {
  return (
    <section id={id} className={cn(
        "relative scroll-mt-20 overflow-hidden rounded-lg border border-border bg-card shadow-[var(--shadow-card)]",
        tone === "ml" && "border-ml/30",
        className,
      )} aria-label={title}>
      {tone !== "default" && (
        <span aria-hidden className={cn("absolute inset-x-0 top-0 h-0.5", tone === "ml" ? "bg-ml/70" : "bg-primary/70")} />
      )}
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3.5">
        <div className="min-w-0">
          <h2 className="text-[0.9375rem] font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {badge && <div className="shrink-0">{badge}</div>}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-1/60 px-6 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface-2"><Icon className="h-5 w-5 text-muted-foreground" aria-hidden /></span>
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
