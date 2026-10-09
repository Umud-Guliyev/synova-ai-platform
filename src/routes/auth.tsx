import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { DemoButton, Divider, EmailPasswordForm } from "@/components/auth/AuthForms";
import { safeRedirect } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: (s: { redirect?: unknown }): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: safeRedirect(s.redirect) } : {},
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: safeRedirect(search.redirect) });
  },
  head: () => ({
    meta: [
      { title: "Log in — SYNOVA AI" },
      { name: "description", content: "Log in to SYNOVA AI or explore the synthetic-data demo without registering." },
      { property: "og:title", content: "Log in — SYNOVA AI" },
      { property: "og:description", content: "Retail delivery and installation risk intelligence. Explore the demo instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { redirect: r } = Route.useSearch();
  const to = safeRedirect(r);
  return (
    <AuthLayout
      title="Welcome to SYNOVA AI"
      description="Explore the demo instantly, or log in to your account."
      footer={<>No account? <Link to="/register" search={r ? { redirect: r } : {}} className="text-primary underline underline-offset-4">Register</Link></>}
    >
      <DemoButton redirectTo={to} />
      <Divider />
      <EmailPasswordForm mode="login" redirectTo={to} />
    </AuthLayout>
  );
}
