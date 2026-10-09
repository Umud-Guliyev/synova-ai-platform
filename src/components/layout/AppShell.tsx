import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FlaskConical, LogOut, Menu, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { performSignOut } from "@/lib/auth";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import logo from "@/assets/synova-logo.png.asset.json";
import { primaryNav, secondaryNav, type NavItem } from "./nav";
import { ThemeToggle } from "./ThemeToggle";

function Brand() {
  return (
    <Link to="/" aria-label="SYNOVA AI — Operations Dashboard" className="flex items-center gap-2.5 rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
      <img src={logo.url} alt="" aria-hidden className="h-9 w-9 shrink-0 rounded-md object-contain dark:bg-foreground dark:p-0.5" />
      <span className="min-w-0">
        <span className="block font-display text-sm font-semibold tracking-wide text-foreground">
          SYNOVA AI
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">
          Know the delay before it happens.
        </span>
      </span>
    </Link>
  );
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: (() => void) | undefined }) {
  return (
    <ul className="space-y-1">
      {items.map(({ to, label, icon: Icon }) => (
        <li key={to}>
          <Link
            to={to}
            onClick={onNavigate}
            activeOptions={{ exact: to === "/" }}
            className="group relative flex items-center gap-3 rounded-md px-3 py-2 text-[0.8125rem] text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground data-[status=active]:bg-sidebar-accent data-[status=active]:font-medium data-[status=active]:text-sidebar-accent-foreground"
          >
            <span
              aria-hidden
              className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-sidebar-primary opacity-0 group-data-[status=active]:opacity-100"
            />
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-data-[status=active]:text-sidebar-primary" aria-hidden />
            <span className="truncate">{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export type Account = { email: string | null; isDemo: boolean };

function AccountPanel({ account }: { account: Account }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onSignOut = async () => {
    setBusy(true);
    await performSignOut({
      cancelQueries: () => queryClient.cancelQueries(),
      clearCache: () => queryClient.clear(),
      signOut: () => supabase.auth.signOut(),
      navigateToAuth: () => void navigate({ to: "/auth", replace: true }),
    }).catch(() => setBusy(false));
  };
  return (
    <div className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-3">
      <div className="flex min-w-0 items-center gap-2.5">
        <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-sidebar-border bg-sidebar">
          {account.isDemo ? <FlaskConical className="h-4 w-4 text-primary" /> : <UserRound className="h-4 w-4 text-muted-foreground" />}
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-sidebar-accent-foreground">
            {account.isDemo ? "Demo guest session" : account.email ?? "Signed in"}
          </p>
          <p className="truncate text-[11px] text-muted-foreground">{account.isDemo ? "Synthetic data only" : "Signed-in account"}</p>
        </div>
      </div>
      {account.isDemo && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          <Link to="/register" className="text-primary underline underline-offset-4">Register</Link> to keep a real account.
        </p>
      )}
      <Button variant="ghost" size="sm" className="mt-2 h-8 w-full justify-start px-2" onClick={onSignOut} disabled={busy}>
        <LogOut /> {account.isDemo ? "Exit demo" : "Log out"}
      </Button>
    </div>
  );
}

function SidebarBody({ onNavigate, account, showToggle = true }: { onNavigate?: (() => void) | undefined; account: Account; showToggle?: boolean }) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <Brand />
        {showToggle && <ThemeToggle />}
      </div>
      <nav aria-label="Primary" className="flex-1">
        <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <NavLinks items={primaryNav} onNavigate={onNavigate} />
      </nav>
      <nav aria-label="Secondary" className="border-t border-sidebar-border pt-4">
        <NavLinks items={secondaryNav} onNavigate={onNavigate} />
      </nav>
      <AccountPanel account={account} />
    </div>
  );
}

export function AppShell({ children, account }: { children: ReactNode; account: Account }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-sidebar-border bg-sidebar lg:block">
        <SidebarBody account={account} />
      </aside>

      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-sidebar px-4 py-2.5 lg:hidden">
        <Button variant="ghost" size="icon" aria-label="Open navigation" onClick={() => setOpen(true)}>
          <Menu />
        </Button>
        <Brand />
        <div className="ml-auto"><ThemeToggle /></div>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SheetDescription className="sr-only">Main application sections</SheetDescription>
          <SidebarBody account={account} showToggle={false} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <main id="main" className="lg:pl-64">
        {children}
      </main>
    </div>
  );
}
