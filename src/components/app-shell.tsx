import { type ReactNode, useState } from "react";
import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FolderKanban,
  ListTodo,
  Users,
  ClipboardList,
  LogOut,
  Menu,
  Check,
  ChevronDown,
  UserRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AvailabilityIcon, WithStatus } from "@/components/availability-status";
import { availabilityLabel } from "@/lib/format";
import { AVAILABILITY, type Availability } from "@/lib/types";
import { toast } from "sonner";
import { useCurrentUser, canManageProjects, type AppRole } from "@/hooks/use-current-user";
import { getSession, logout, setMyAvailability } from "@/lib/app.functions";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const nav = [
  { to: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", short: "Projects", icon: FolderKanban },
  { to: "/tasks", label: "Tasks", short: "Tasks", icon: ListTodo },
  { to: "/team", label: "Team", short: "Team", icon: Users },
  // Admin / Super Admin only — kept last in the list.
  { to: "/logs", label: "Application Logs", short: "Logs", icon: ClipboardList, adminOnly: true },
] as const;

const navFor = (role?: AppRole) =>
  nav.filter((item) => !("adminOnly" in item && item.adminOnly) || canManageProjects(role));

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
  role,
  onNavigate,
  rail,
}: {
  pathname: string;
  role?: AppRole;
  onNavigate?: () => void;
  rail?: boolean;
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-1">
      {navFor(role).map((item) => {
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
      <NavList pathname={pathname} role={me?.role} onNavigate={onNavigate} rail={rail} />
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
function BottomNav({ pathname, role }: { pathname: string; role?: AppRole }) {
  const items = navFor(role);
  return (
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]">
      <div className={cn("grid", items.length > 4 ? "grid-cols-5" : "grid-cols-4")}>
        {items.map((item) => {
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

  const firstName =
    me?.profile?.full_name?.trim().split(/\s+/)[0] || me?.user.email.split("@")[0] || "there";

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
            {/* Same avatar as the sidebar footer; opens Settings (my profile). */}
            <UserMenu
              firstName={firstName}
              initials={initials}
              availability={me?.profile?.availability}
            />
          </div>
        </header>
        {/* Bottom padding on phones keeps content clear of the fixed tab bar. */}
        <main className="flex-1 min-w-0 px-3 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-8">
          {children}
        </main>
      </div>

      <BottomNav pathname={pathname} role={me?.role} />
    </div>
  );
}

/** Header avatar + greeting. Opens a menu to set your status (availability) or go to your profile. */
function UserMenu({
  firstName,
  initials,
  availability,
}: {
  firstName: string;
  initials: string;
  availability?: Availability | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const current = availability ?? "available";

  const setStatus = useMutation({
    mutationFn: (value: Availability) => setMyAvailability({ data: { availability: value } }),
    // Update the header straight away; roll back if the save fails.
    onMutate: async (value) => {
      await qc.cancelQueries({ queryKey: ["current-user"] });
      const previous = qc.getQueryData(["current-user"]);
      qc.setQueryData(["current-user"], (old: Awaited<ReturnType<typeof getSession>>) =>
        old?.profile ? { ...old, profile: { ...old.profile, availability: value } } : old,
      );
      return { previous };
    },
    onError: (e: Error, _v, ctx) => {
      qc.setQueryData(["current-user"], ctx?.previous);
      toast.error(e.message);
    },
    onSuccess: (_r, value) => toast.success(`Status set to ${availabilityLabel(value)}`),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["current-user"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={`Status: ${availabilityLabel(current)}`}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 sm:pr-2 hover:bg-accent/60 transition-colors"
        >
          <WithStatus value={current} size="md">
            <Avatar className="h-8 w-8 md:h-9 md:w-9">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </WithStatus>
          <span className="hidden sm:inline text-sm font-medium truncate max-w-[10rem]">
            Hi, {firstName}
          </span>
          <ChevronDown className="hidden sm:block h-4 w-4 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" collisionPadding={12} className="w-56 p-1">
        <p className="px-2 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">Select status</p>
        {AVAILABILITY.map((a) => (
          <button
            key={a}
            type="button"
            disabled={setStatus.isPending}
            onClick={() => {
              setOpen(false);
              if (a !== current) setStatus.mutate(a);
            }}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent disabled:opacity-60",
              a === current && "font-medium",
            )}
          >
            <AvailabilityIcon value={a} />
            <span className="flex-1 text-left">{availabilityLabel(a)}</span>
            {a === current && <Check className="h-4 w-4 text-muted-foreground" />}
          </button>
        ))}
        <div className="my-1 h-px bg-border" />
        <Link
          to="/settings"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm hover:bg-accent"
        >
          <UserRound className="h-4 w-4 text-muted-foreground" />
          My profile
        </Link>
      </PopoverContent>
    </Popover>
  );
}
