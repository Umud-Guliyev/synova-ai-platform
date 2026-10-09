import { useState, type FormEvent } from "react";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Loader2, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage, validateCredentials } from "@/lib/auth";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {message}
    </p>
  );
}

const toAuthErr = (e: unknown) => (e instanceof Error ? { message: e.message, name: e.name } : null);

export function DemoButton({ redirectTo }: { redirectTo: string }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) throw error;
      await navigate({ to: redirectTo, replace: true });
    } catch (e) {
      setError(authErrorMessage((e as { message?: string; status?: number; code?: string }) ?? toAuthErr(e), "demo"));
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      <Button type="button" className="w-full" size="lg" onClick={start} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <PlayCircle />} Explore Demo
      </Button>
      <p className="text-center text-xs text-muted-foreground">No registration needed. Opens a temporary guest session with synthetic demo data.</p>
      <ErrorText message={error} />
    </div>
  );
}

export function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
      <span className="h-px flex-1 bg-border" /> or use an account <span className="h-px flex-1 bg-border" />
    </div>
  );
}

export function EmailPasswordForm({ mode, redirectTo }: { mode: "login" | "register"; redirectTo: string }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const fieldError = validateCredentials(email, password, mode);
    if (fieldError) {
      setError(fieldError);
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        await navigate({ to: redirectTo, replace: true });
        return;
      }
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw error;
      if (data.session) {
        await navigate({ to: redirectTo, replace: true });
        return;
      }
      setNotice("Account created. Check your email to confirm it, then log in.");
    } catch (err) {
      setError(authErrorMessage((err as { message?: string; status?: number; code?: string }) ?? toAuthErr(err), mode));
    }
    setBusy(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password" type="password" required minLength={mode === "register" ? 8 : undefined}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        {mode === "register" && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
      </div>
      <ErrorText message={error} />
      {notice && <p role="status" className="rounded-md border border-border bg-surface-2 px-3 py-2 text-sm">{notice}</p>}
      <Button type="submit" variant="outline" className="w-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" />} {mode === "login" ? "Log in" : "Create account"}
      </Button>
    </form>
  );
}
