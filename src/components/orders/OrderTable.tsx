import { Link } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RiskBadge } from "@/components/RiskBadge";
import { deliveryLabel, installLabel } from "@/lib/order-filters";
import type { AssessedOrder } from "@/lib/risk";

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

export function OrderTable({
  orders,
  from,
  showScore = false,
  caption,
}: {
  orders: AssessedOrder[];
  from: "dashboard" | "orders";
  showScore?: boolean;
  caption?: string;
}) {
  return (
    <div className="-mx-5 overflow-x-auto" tabIndex={0} role="region" aria-label={caption ?? "Orders table"}>
      <Table className={showScore ? "min-w-[980px]" : "min-w-[860px]"}>
        {caption && <caption className="sr-only">{caption}</caption>}
        <TableHeader className="bg-surface-1/70 [&_th]:h-9 [&_th]:text-[11px] [&_th]:font-medium [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
          <TableRow>
            <TableHead className="pl-5">Order</TableHead>
            <TableHead>Product</TableHead>
            <TableHead>Expected</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead>Installation</TableHead>
            <TableHead>Risk</TableHead>
            {showScore && (
              <TableHead className="text-right">
                <abbr title="Rule-based priority score out of 100. Not a probability of delay." className="no-underline">
                  Rule score
                </abbr>
              </TableHead>
            )}
            <TableHead className="pr-5">{showScore ? "Risk factors" : "Primary factor"}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((o) => (
            <TableRow key={o.id} className="hover:bg-surface-2/60 [&_td]:py-2.5">
              <TableCell className="pl-5">
                <Link
                  to="/orders/$orderId"
                  params={{ orderId: o.id }}
                  search={{ from }}
                  className="whitespace-nowrap rounded font-mono text-xs text-primary underline underline-offset-4 decoration-primary/40 hover:decoration-primary"
                  aria-label={`Open order details for ${o.id}`}
                >
                  {o.id}
                </Link>
              </TableCell>
              <TableCell className="text-sm font-medium">{o.product}</TableCell>
              <TableCell className="whitespace-nowrap font-mono text-xs">{fmtDate(o.expectedDelivery)}</TableCell>
              <TableCell className="text-xs">{deliveryLabel[o.deliveryStatus]}</TableCell>
              <TableCell className="text-xs">{installLabel[o.installationStatus]}</TableCell>
              <TableCell><RiskBadge level={o.assessment.level} /></TableCell>
              {showScore && (
                <TableCell className="whitespace-nowrap text-right font-mono text-xs tabular">
                  {o.assessment.score}
                  <span className="text-muted-foreground">/100</span>
                </TableCell>
              )}
              <TableCell className="pr-5 text-xs text-muted-foreground">
                {o.assessment.factors.length === 0 ? (
                  <span>No risk factors identified</span>
                ) : showScore ? (
                  <ul className="space-y-0.5">
                    {o.assessment.factors.map((f) => (
                      <li key={f.description}>{f.description}</li>
                    ))}
                  </ul>
                ) : (
                  o.assessment.primaryFactor
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
