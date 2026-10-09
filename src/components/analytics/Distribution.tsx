import type { ReactNode } from "react";

export type DistItem = { key: string; label: ReactNode; text: string; value: number; barClass: string };

/** Stacked bar (decorative) plus a text list carrying the same values, so meaning never relies on color. */
export function Distribution({ items, total, label }: { items: DistItem[]; total: number; label: string }) {
  return (
    <figure>
      <div className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        {total > 0 &&
          items.filter((i) => i.value > 0).map((i) => (
            <div key={i.key} className={i.barClass} style={{ width: `${(i.value / total) * 100}%` }} />
          ))}
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      {total === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No records to summarize.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((i) => (
            <li key={i.key} className="flex items-center justify-between gap-3 text-sm" aria-label={`${i.text}: ${i.value} of ${total}`}>
              <span className="flex min-w-0 items-center gap-2">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${i.barClass}`} aria-hidden />
                <span className="min-w-0">{i.label}</span>
              </span>
              <span className="shrink-0 font-mono tabular">
                {i.value} <span className="text-muted-foreground">/ {total}</span>
                <span className="ml-2 inline-block w-10 text-right text-xs text-muted-foreground">{Math.round((i.value / total) * 100)}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </figure>
  );
}
