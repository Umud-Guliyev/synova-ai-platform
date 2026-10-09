import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { DemoButton, Divider, EmailPasswordForm } from "@/components/auth/AuthForms";
import { isDemoUser, safeRedirect } from "@/lib/auth";

export const Route = createFileRoute("/register")({
  ssr: false,
  validateSearch: (s: { redirect?: unknown }): { redirect?: string } =>
    typeof s.redirect === "string" ? { redirect: safeRedirect(s.redirect) } : {},
  beforeLoad: async ({ search }) => {
    const { data } = await supabase.auth.getUser();
    // Demo guests may still open Register to create a real account.
    if (data.user && !isDemoUser(data.user)) throw redirect({ to: safeRedirect(search.redirect) });
  },
  head: () => ({
    meta: [
      { title: "Register — SYNOVA AI" },
      { name: "description", content: "Create a SYNOVA AI account with email and password." },
      { property: "og:title", content: "Register — SYNOVA AI" },
      { property: "og:description", content: "Create an account or explore the synthetic-data demo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const { redirect: r } = Route.useSearch();
  const to = safeRedirect(r);
  return (
    <AuthLayout
      title="Create your account"
      description="Register with email and password. Accounts see the same synthetic demo data."
      footer={<>Already registered? <Link to="/auth" search={r ? { redirect: r } : {}} className="text-primary underline underline-offset-4">Log in</Link></>}
    >
      <EmailPasswordForm mode="register" redirectTo={to} />
      <Divider />
      <DemoButton redirectTo={to} />
    </AuthLayout>
  );
}
