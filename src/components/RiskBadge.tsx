import { AlertOctagon, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type RiskLevel = "high" | "medium" | "low" | "info";

const map = {
  high: { label: "High risk", variant: "danger", icon: AlertOctagon },
  medium: { label: "Medium risk", variant: "warning", icon: AlertTriangle },
  low: { label: "On track", variant: "success", icon: CheckCircle2 },
  info: { label: "Info", variant: "info", icon: Info },
} as const;

/** Risk is always conveyed with icon + text, never color alone. */
export function RiskBadge({ level }: { level: RiskLevel }) {
  const { label, variant, icon: Icon } = map[level];
  return (
    <Badge variant={variant} className="gap-1.5 whitespace-nowrap">
      <Icon className="h-3 w-3" aria-hidden />
      {label}
    </Badge>
  );
}
