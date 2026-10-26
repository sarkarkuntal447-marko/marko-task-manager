import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSession, login } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Marko Projects" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    getSession()
      .then((me) => {
        if (me) navigate({ to: "/dashboard" });
      })
      .catch(() => undefined);
  }, [navigate]);

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login({ data: { email, password } });
      await qc.invalidateQueries();
      toast.success("Welcome back");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border font-display font-bold text-lg">
          <img
            src="/favicon.ico"
            alt="Marko & Brando"
            className="h-10 w-10 shrink-0 rounded-full object-contain"
          />
          <span>Marko Projects</span>
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl xl:text-4xl font-display font-bold leading-tight">
            One command deck for every project, person, and deadline.
          </h1>
          <p className="text-primary-foreground/80">
            Track web builds, CRMs, ERPs and custom software end-to-end. Phases, tasks, credentials,
            SSL expiries and team workload — all in one place.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/60">© Marko Projects · Internal use only</p>
      </div>

      <div className="flex items-center justify-center px-4 py-8 sm:p-6 bg-background pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <Card className="w-full max-w-md p-6 sm:p-8 shadow-card border-border/60">
          <div className="lg:hidden flex items-center gap-2 font-display font-bold text-xl mb-6">
            <img
              src="/favicon.ico"
              alt="Marko & Brando"
              className="h-9 w-9 shrink-0 rounded-full object-contain"
            />{" "}
            Marko Projects
          </div>
          <h2 className="text-2xl font-display font-bold">Welcome</h2>
          <p className="text-sm text-muted-foreground mb-6">Sign in to your workspace</p>

          <form onSubmit={signIn} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign in
            </Button>
            <p className="text-xs text-muted-foreground text-center pt-2">
              Accounts are created by an administrator. Contact your admin for access.
            </p>
          </form>
        </Card>
      </div>
    </div>
  );
}
