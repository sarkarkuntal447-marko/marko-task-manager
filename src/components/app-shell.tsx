import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, FolderKanban, ListTodo, Users, ClipboardList,
  Settings, LogOut, Compass, Bell, Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentUser } from "@/hooks/use-current-user";
import { logout, listActivity } from "@/lib/app.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", icon: ListTodo },
  { to: "/logs", label: "Daily Logs", icon: ClipboardList },
  { to: "/team", label: "Team", icon: Users },
] as const;

const roleLabel: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  moderator: "Moderator",
  developer: "Developer",
};

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex-1 p-3 space-y-1">
      {nav.map((item) => {
        const active = pathname === item.to || pathname.startsWith(item.to + "/");
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  pathname, me, initials, signOut, onNavigate,
}: {
  pathname: string; me: any; initials: string; signOut: () => void; onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="h-16 flex items-center gap-2 px-5 border-b border-sidebar-border font-display font-bold text-lg">
        <img
          src="/public/favicon.ico"
          alt="Marko & Brando"
          className="h-10 w-10 shrink-0 rounded-full object-contain"
        /> 
        <span>Marko Projects</span>
      </div>
      <NavList pathname={pathname} onNavigate={onNavigate} />
      <div className="p-3 border-t border-sidebar-border">
        <Link to="/settings" onClick={onNavigate} className="flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/60">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{me?.profile?.full_name ?? me?.user.email}</p>
            <p className="text-xs text-muted-foreground truncate">
              {me?.role ? roleLabel[me.role] : ""}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); e.stopPropagation(); signOut(); }} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await logout();
    navigate({ to: "/auth", replace: true });
  };

  const initials = (me?.profile?.full_name ?? me?.user.email ?? "U")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="min-h-screen w-full flex bg-background">
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-sidebar-border">
        <SidebarBody pathname={pathname} me={me} initials={initials} signOut={signOut} />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-4 md:px-8 border-b border-border bg-card/40 backdrop-blur-sm flex items-center gap-2 sticky top-0 z-10">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" title="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-72">
              <SidebarBody
                pathname={pathname}
                me={me}
                initials={initials}
                signOut={signOut}
                onNavigate={() => setMobileOpen(false)}
              />
            </SheetContent>
          </Sheet>
          <div className="md:hidden font-display font-bold flex items-center gap-2">
            <img
          src="/public/favicon.ico"
          alt="Marko & Brando"
          className="h-10 w-10 shrink-0 rounded-full object-contain"
        /> 
        <span>Marko Projects</span>
          </div>
          <div className="flex-1" />
          <NotificationsBell userId={me?.user.id} />
          <Button asChild variant="ghost" size="icon" title="Settings">
            <Link to="/settings"><Settings className="h-4 w-4" /></Link>
          </Button>
        </header>
        <main className="flex-1 p-4 md:p-8 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

type ActivityItem = {
  id: string;
  actor_name?: string | null;
  action: string;
  entity_name?: string | null;
  created_at: string;
};

function NotificationsBell({ userId }: { userId?: string }) {
  const storageKey = userId ? `bell-seen:${userId}` : "bell-seen:anon";
  const [seenAt, setSeenAt] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(storageKey) ?? "";
  });

  const { data: items = [] } = useQuery<ActivityItem[]>({
    queryKey: ["bell-activity"],
    queryFn: async (): Promise<ActivityItem[]> => {
      const result = await listActivity({ data: { limit: 10 } });
      return Array.isArray(result) ? (result as ActivityItem[]) : [];
    },
    refetchInterval: 60_000,
  });

  const latest = items[0]?.created_at ?? "";
  const hasNew = !!latest && latest > seenAt;

  const markSeen = () => {
    if (!latest) return;
    setSeenAt(latest);
    if (typeof window !== "undefined") window.localStorage.setItem(storageKey, latest);
  };

  return (
    <Popover onOpenChange={(o) => { if (o) markSeen(); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-4 w-4" />
          {hasNew && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="p-3 border-b border-border font-semibold text-sm">Recent activity</div>
        <ul className="max-h-80 overflow-auto">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">Nothing yet.</li>
          ) : items.map((a: any) => (
            <li key={a.id} className="p-3 border-b border-border last:border-0 text-sm">
              <p className="truncate">
                <b>{a.actor_name ?? "Someone"}</b>{" "}
                <span className="text-muted-foreground">{a.action.replace(/[._]/g, " ")}</span>{" "}
                <b>{a.entity_name}</b>
              </p>
              <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
            </li>
          ))}
        </ul>
        <div className="p-2 border-t border-border">
          <Button asChild variant="ghost" size="sm" className="w-full">
            <Link to="/logs">View all</Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
