import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/layout/AppShell";
import { guardDecision, isDemoUser } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    const d = guardDecision(data.user, location.href);
    if (!d.allow) throw redirect({ to: "/auth", search: { redirect: d.redirectTo } });
    return { user: data.user! };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext();
  return (
    <AppShell account={{ email: user.email ?? null, isDemo: isDemoUser(user) }}>
      <Outlet />
    </AppShell>
  );
}
