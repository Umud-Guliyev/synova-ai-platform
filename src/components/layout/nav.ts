import { LayoutDashboard, ShieldAlert, Wrench, LineChart, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  to: "/" | "/orders" | "/interventions" | "/analytics" | "/settings";
  label: string;
  icon: LucideIcon;
};

export const primaryNav: NavItem[] = [
  { to: "/", label: "Operations Dashboard", icon: LayoutDashboard },
  { to: "/orders", label: "Order Risk Monitor", icon: ShieldAlert },
  { to: "/interventions", label: "Intervention Center", icon: Wrench },
  { to: "/analytics", label: "AI Quality & Analytics", icon: LineChart },
];

export const secondaryNav: NavItem[] = [{ to: "/settings", label: "Settings", icon: Settings }];
