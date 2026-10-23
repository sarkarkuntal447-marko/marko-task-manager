import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getSession } from "@/lib/app.functions";
import { AppShell } from "@/components/app-shell";
import { AppShellSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const me = await getSession();
    if (!me) throw redirect({ to: "/auth" });
    return { user: me.user };
  },
  // Show the skeleton shell almost immediately while the session is checked, instead of a blank screen.
  pendingComponent: AppShellSkeleton,
  pendingMs: 100,
  pendingMinMs: 300,
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
