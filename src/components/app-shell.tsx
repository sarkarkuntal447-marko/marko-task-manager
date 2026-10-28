import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Users,
  ClipboardList,
  Settings,
  LogOut,
  Bell,
  Menu,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCurrentUser } from "@/hooks/use-current-user";
import { getSession, logout, listActivity } from "@/lib/app.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", short: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  { to: "/logs", label: "Daily Logs", short: "Logs", icon: ClipboardList },
  { to: "/team", label: "Team", short: "Team", icon: Users },
] as const;

const roleLabel: Record<string, string> = {
  Super_Admin: "Super Admin",
  Admin: "Admin",
  SEO: "SEO",
  Developer: "Developer",
};

const isActive = (pathname: string, to: string) => pathname === to || pathname.startsWith(to + "/");

// `rail` = the desktop sidebar. On tablets (md) it shrinks to an icon-only rail; on lg+ it shows labels.
function NavList({
  pathname,
  onNavigate,
  rail,
}: {
  pathname: string;
  onNavigate?: () => void;
  rail?: boolean;
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-1">
      {nav.map((item) => {
        const active = isActive(pathname, item.to);
        const Icon = item.icon;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            title={item.label}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              rail && "md:max-lg:justify-center md:max-lg:px-0",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", rail && "md:max-lg:h-5 md:max-lg:w-5")} />
            <span className={cn(rail && "md:max-lg:sr-only")}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBody({
  pathname,
  me,
  initials,
  signOut,
  onNavigate,
  rail,
}: {
  pathname: string;
  me: Awaited<ReturnType<typeof getSession>> | undefined;
  initials: string;
  signOut: () => void;
  onNavigate?: () => void;
  rail?: boolean;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div
        className={cn(
          "h-16 shrink-0 flex items-center gap-2 px-5 border-b border-sidebar-border font-display font-bold text-lg",
          rail && "md:max-lg:justify-center md:max-lg:px-0",
        )}
      >
        <img
          src="/favicon.ico"
          alt="Marko & Brando"
          className="h-10 w-10 shrink-0 rounded-full object-contain"
        />
        <span className={cn("truncate", rail && "md:max-lg:hidden")}>Marko Projects</span>
      </div>
      <NavList pathname={pathname} onNavigate={onNavigate} rail={rail} />
      <div className="p-3 border-t border-sidebar-border pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Link
          to="/settings"
          onClick={onNavigate}
          title="Settings"
          className={cn(
            "flex items-center gap-3 p-2 rounded-lg hover:bg-sidebar-accent/60",
            rail && "md:max-lg:flex-col md:max-lg:gap-1 md:max-lg:px-0",
          )}
        >
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className={cn("flex-1 min-w-0", rail && "md:max-lg:hidden")}>
            <p className="text-sm font-medium truncate">
              {me?.profile?.full_name ?? me?.user.email}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {me?.role ? roleLabel[me.role] : ""}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              signOut();
            }}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </Link>
      </div>
    </div>
  );
}

/** Phone-only tab bar fixed to the bottom of the screen (app-style navigation for the PWA). */
function BottomNav({ pathname }: { pathname: string }) {
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5">
        {nav.map((item) => {
          const active = isActive(pathname, item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-1 h-16 text-[11px] font-medium transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-primary text-primary-foreground",
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              {item.short}
            </Link>
          );
        })}
      </div>
    </nav>
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
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-dvh w-full flex bg-background">
      <aside className="hidden md:flex md:w-20 lg:w-64 shrink-0 flex-col border-r border-sidebar-border sticky top-0 h-dvh">
        <SidebarBody pathname={pathname} me={me} initials={initials} signOut={signOut} rail />
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-sm pt-[env(safe-area-inset-top)]">
          <div className="h-14 md:h-16 px-2 sm:px-4 md:px-8 flex items-center gap-1 sm:gap-2">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" title="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-72 max-w-[85vw]">
                <SidebarBody
                  pathname={pathname}
                  me={me}
                  initials={initials}
                  signOut={signOut}
                  onNavigate={() => setMobileOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <Link
              to="/dashboard"
              className="md:hidden font-display font-bold flex items-center gap-2 min-w-0"
            >
              <img
                src="/favicon.ico"
                alt="Marko & Brando"
                className="h-8 w-8 shrink-0 rounded-full object-contain"
              />
              <span className="truncate">Marko Projects</span>
            </Link>
            <div className="flex-1" />
            <NotificationsBell userId={me?.user.id} />
            <Button asChild variant="ghost" size="icon" title="Settings">
              <Link to="/settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </header>
        {/* Bottom padding on phones keeps content clear of the fixed tab bar. */}
        <main className="flex-1 min-w-0 px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav pathname={pathname} />
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
    <Popover
      onOpenChange={(o) => {
        if (o) markSeen();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notifications">
          <Bell className="h-4 w-4" />
          {hasNew && (
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        collisionPadding={12}
        className="w-[calc(100vw-1.5rem)] max-w-80 p-0"
      >
        <div className="p-3 border-b border-border font-semibold text-sm">Recent activity</div>
        <ul className="max-h-[60dvh] sm:max-h-80 overflow-auto">
          {items.length === 0 ? (
            <li className="p-4 text-sm text-muted-foreground">Nothing yet.</li>
          ) : (
            items.map((a) => (
              <li key={a.id} className="p-3 border-b border-border last:border-0 text-sm">
                <p className="line-clamp-2 break-words">
                  <b>{a.actor_name ?? "Someone"}</b>{" "}
                  <span className="text-muted-foreground">{a.action.replace(/[._]/g, " ")}</span>{" "}
                  <b>{a.entity_name}</b>
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString()}
                </p>
              </li>
            ))
          )}
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
