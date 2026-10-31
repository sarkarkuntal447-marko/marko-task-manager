import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/app.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  ListTodo,
  TrendingUp,
  PauseCircle,
  ChevronRight,
  ArrowRight,
  Crown,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  statusLabel,
  statusColor,
  fmtDate,
  availabilityLabel,
  priorityLabel,
  projectTypeColor,
} from "@/lib/format";
import { PROJECT_TYPE_LABEL, isActive, isDelivered } from "@/lib/project-status";
import { PRIORITIES } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AvailabilityIcon, WithStatus } from "@/components/availability-status";
import { MetricCardSkeleton, ChartCardSkeleton, ListRowsSkeleton } from "@/components/skeletons";
import { useCurrentUser } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Marko Projects" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => getDashboard(),
  });
  const { data: me } = useCurrentUser();
  // Super admins don't sit on project teams, so they get a full-width Team Status instead.
  const isSuperAdmin = me?.role === "Super_Admin";

  const isAdmin = !!data?.isAdmin;
  const projects = data?.projects ?? [];
  const scopeProjects = data?.scopeProjects ?? [];
  const tasks = data?.tasks ?? [];
  const scopeTasks = data?.scopeTasks ?? [];
  const team = data?.team ?? [];
  const recent = projects.slice(0, 6);

  // Department-wide project counts (admins and super admins only).
  const total = projects.length;
  const active = projects.filter((p) => isActive(p.status)).length;
  const completed = projects.filter((p) => isDelivered(p.status)).length;
  const onHold = projects.filter((p) => p.status === "on_hold").length;
  // Admins: delays across the department; everyone else: delays on their own projects.
  const delayed = scopeProjects.filter((p) => p.progress < 100 && isActive(p.status)).length;

  const pendingTasks = tasks.filter((t) => t.status !== "completed").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  // Everyone who is working today, whether in the office or from home.
  const workingToday = team.filter((p) =>
    ["available", "busy", "focus", "wfh"].includes(p.availability ?? ""),
  ).length;

  const statusCounts = scopeProjects.reduce<Record<string, number>>((a, p) => {
    a[p.status] = (a[p.status] ?? 0) + 1;
    return a;
  }, {});
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({
    name: statusLabel(k),
    value: v,
  }));
  const COLORS = [
    "hsl(259 70% 55%)",
    "hsl(155 50% 50%)",
    "hsl(75 70% 55%)",
    "hsl(25 75% 55%)",
    "hsl(230 60% 55%)",
    "hsl(320 50% 55%)",
  ];

  const taskByPriority = [...PRIORITIES].reverse().map((p) => ({
    priority: priorityLabel(p),
    Pending: scopeTasks.filter((t) => t.priority === p && t.status !== "completed").length,
    Completed: scopeTasks.filter((t) => t.priority === p && t.status === "completed").length,
  }));
  const chartScope = isAdmin ? "All projects in your department" : "Projects you work on";

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Your team, your projects and your work at a glance. Click any card to navigate.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            {isAdmin && (
              <>
                <Metric
                  icon={FolderKanban}
                  label="Total Projects"
                  value={total}
                  tone="primary"
                  to="/projects"
                />
                <Metric
                  icon={TrendingUp}
                  label="Active Project"
                  value={active}
                  tone="info"
                  to="/projects"
                  search={{ status: "active" }}
                />
                <Metric
                  icon={CheckCircle2}
                  label="Completed Project"
                  value={completed}
                  tone="success"
                  to="/projects"
                  search={{ status: "delivered" }}
                />
                <Metric
                  icon={PauseCircle}
                  label="On Hold Projects"
                  value={onHold}
                  tone="muted"
                  to="/projects"
                  search={{ status: "on_hold" }}
                />
              </>
            )}
            <Metric
              icon={AlertTriangle}
              label={isAdmin ? "Delayed" : "Delayed (my projects)"}
              value={delayed}
              tone="warning"
              to="/projects"
              search={{ status: "delayed" }}
            />
            <Metric
              icon={Users}
              label="Employees"
              value={team.length}
              sub={`${workingToday} working today`}
              tone="primary"
              to="/team"
            />
            <Metric
              icon={ListTodo}
              label="Pending Tasks"
              value={pendingTasks}
              tone="info"
              to="/tasks"
            />
            <Metric
              icon={Clock}
              label="Completed Tasks"
              value={completedTasks}
              tone="success"
              to="/tasks"
            />
          </>
        )}
      </div>

      {isSuperAdmin ? (
        <TeamStatus team={team} loading={isLoading} wide />
      ) : (
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
          <TeamStatus team={team} loading={isLoading} />
          <AccessibleProjects projects={data?.myProjects ?? []} loading={isLoading} />
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-3 sm:gap-4">
        {isLoading ? (
          <>
            <ChartCardSkeleton className="lg:col-span-1" />
            <ChartCardSkeleton className="lg:col-span-2" />
          </>
        ) : (
          <>
            <Card className="p-4 sm:p-6 lg:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Project Status</h3>
                  <p className="text-xs text-muted-foreground">{chartScope}</p>
                </div>
                <Link
                  to="/projects"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="h-56 sm:h-64">
                {pieData.length === 0 ? (
                  <EmptyChart label="No projects yet" />
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={pieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius="55%"
                        outerRadius="85%"
                        paddingAngle={2}
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-4 sm:p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">Tasks by Priority</h3>
                  <p className="text-xs text-muted-foreground">{chartScope}</p>
                </div>
                <Link
                  to="/tasks"
                  className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                >
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              <div className="h-56 sm:h-64">
                <ResponsiveContainer>
                  <BarChart
                    data={taskByPriority}
                    margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="priority"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      interval={0}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      allowDecimals={false}
                      width={40}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="Pending" fill="hsl(259 70% 60%)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="Completed" fill="hsl(155 50% 50%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </>
        )}
      </div>

      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Recent Projects</h3>
          <Link
            to="/projects"
            className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
          >
            All projects <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {isLoading ? (
          <ListRowsSkeleton rows={4} />
        ) : recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Create one from the Projects page.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {recent.map((p) => (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="py-3 flex items-center gap-3 sm:gap-4 -mx-2 px-2 rounded-lg hover:bg-muted/60 transition-colors group cursor-pointer block no-underline"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate group-hover:text-primary transition-colors">
                    {p.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    Due {fmtDate(p.expected_delivery_date)}
                  </p>
                </div>
                {/* Fixed-width columns keep every row's progress bar and status lined up. */}
                <div className="w-40 hidden sm:block shrink-0">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.progress}%</p>
                </div>
                <div className="sm:w-64 shrink-0 flex">
                  <Badge variant="secondary" className={statusColor(p.status)}>
                    {statusLabel(p.status)}
                  </Badge>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  sub,
  tone,
  to,
  search,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  sub?: string;
  tone: "primary" | "success" | "warning" | "info" | "muted";
  to?: string;
  search?: Record<string, string>;
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary/20",
    success: "bg-success/15 text-success group-hover:bg-success/25",
    warning: "bg-warning/20 text-warning-foreground group-hover:bg-warning/30",
    info: "bg-info/15 text-info group-hover:bg-info/25",
    muted: "bg-muted text-muted-foreground group-hover:bg-muted/80",
  };

  const cardContent = (
    <Card className="p-3 sm:p-4 min-w-0 h-full transition-all duration-200 hover:shadow-md hover:border-primary/50 hover:-translate-y-0.5 group cursor-pointer">
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 sm:h-10 sm:w-10 shrink-0 rounded-lg flex items-center justify-center transition-colors ${toneClass[tone]}`}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p
              className="text-[11px] sm:text-xs text-muted-foreground uppercase tracking-wide truncate group-hover:text-foreground transition-colors"
              title={label}
            >
              {label}
            </p>
            {to && (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/30 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
            )}
          </div>
          <p className="text-xl sm:text-2xl font-bold leading-none mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1 truncate">{sub}</p>}
        </div>
      </div>
    </Card>
  );

  if (to) {
    return (
      <Link to={to} search={search} className="block no-underline">
        {cardContent}
      </Link>
    );
  }

  return cardContent;
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

type TeamMember = Awaited<ReturnType<typeof getDashboard>>["team"][number];
type MyProject = Awaited<ReturnType<typeof getDashboard>>["myProjects"][number];

/** Active members of your department(s) and what they're up to right now. `wide` shows two per row. */
function TeamStatus({
  team,
  loading,
  wide = false,
}: {
  team: TeamMember[];
  loading: boolean;
  wide?: boolean;
}) {
  return (
    <Card className="p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Team Status</h3>
        <Link
          to="/team"
          className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
        >
          Team <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {loading ? (
        <ListRowsSkeleton rows={4} />
      ) : team.length === 0 ? (
        <p className="text-sm text-muted-foreground">No team members in your department yet.</p>
      ) : (
        <div
          className={`${wide ? "grid md:grid-cols-2 gap-x-8 gap-y-1" : "space-y-1"} max-h-72 overflow-auto overscroll-contain -mx-2 px-2`}
        >
          {team.map((m) => (
            <Link
              key={m.id}
              to="/team/$id"
              params={{ id: m.id }}
              className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors no-underline"
            >
              <WithStatus value={m.availability}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                    {initialsOf(m.full_name ?? "U")}
                  </AvatarFallback>
                </Avatar>
              </WithStatus>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{m.full_name ?? "Team member"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[m.designation, m.department].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge variant="secondary" className="gap-1.5 shrink-0">
                <AvailabilityIcon value={m.availability} className="h-3.5 w-3.5" />
                {availabilityLabel(m.availability) || "Available"}
              </Badge>
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Projects you're on the team of, or own as single-threaded owner (crown). */
function AccessibleProjects({ projects, loading }: { projects: MyProject[]; loading: boolean }) {
  return (
    <Card className="p-4 sm:p-6 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Accessible Projects</h3>
        <Badge variant="secondary">{projects.length}</Badge>
      </div>
      {loading ? (
        <ListRowsSkeleton rows={4} />
      ) : projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">You are not on any project team yet.</p>
      ) : (
        <div className="space-y-1 max-h-72 overflow-auto overscroll-contain -mx-2 px-2">
          {projects.map((p) => (
            <Link
              key={p.id}
              to="/projects/$id"
              params={{ id: p.id }}
              className="flex items-center gap-3 py-2 px-2 -mx-2 rounded-lg hover:bg-muted/60 transition-colors group no-underline"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5 group-hover:text-primary transition-colors">
                  {p.isOwner && (
                    <Crown
                      className="h-3.5 w-3.5 text-amber-500 shrink-0"
                      aria-label="Single-threaded owner"
                    />
                  )}
                  <span className="truncate">{p.name}</span>
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  Due {fmtDate(p.expected_delivery_date)}
                </p>
              </div>
              {/* Fixed-width columns keep the badges lined up from row to row. */}
              <div className="w-14 shrink-0 flex">
                <Badge variant="outline" className={projectTypeColor(p.project_type)}>
                  {PROJECT_TYPE_LABEL[p.project_type]}
                </Badge>
              </div>
              <div className="hidden sm:flex sm:w-64 shrink-0">
                <Badge variant="secondary" className={statusColor(p.status)}>
                  {statusLabel(p.status)}
                </Badge>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors shrink-0" />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
