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
import { statusLabel, statusColor, fmtDate } from "@/lib/format";
import { MetricCardSkeleton, ChartCardSkeleton, ListRowsSkeleton } from "@/components/skeletons";

type DashboardProject = {
  id: string;
  name: string;
  expected_delivery_date?: string | null;
  progress: number;
  status: string;
};
type DashboardTask = { status: string; priority: string };
type DashboardProfile = { availability?: string | null };
type DashboardData = {
  projects: DashboardProject[];
  tasks: DashboardTask[];
  profiles: DashboardProfile[];
  recent: DashboardProject[];
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Marko Projects" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const d = (await getDashboard()) as Omit<DashboardData, "recent">;
      return { ...d, recent: d.projects.slice(0, 6) };
    },
  });

  const projects = data?.projects ?? [];
  const tasks = data?.tasks ?? [];
  const profiles = data?.profiles ?? [];

  const total = projects.length;
  const active = projects.filter(
    (p) => !["completed", "on_hold", "cancelled"].includes(p.status),
  ).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const onHold = projects.filter((p) => p.status === "on_hold").length;
  const delayed = projects.filter(
    (p) => p.progress < 100 && !["completed", "cancelled"].includes(p.status),
  ).length;

  const pendingTasks = tasks.filter((t) => t.status !== "completed").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  const employees = profiles.length;
  const activeEmployees = profiles.filter(
    (p) => p.availability === "available" || p.availability === "busy",
  ).length;

  const statusCounts = projects.reduce<Record<string, number>>((a, p) => {
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

  const taskByPriority = ["low", "medium", "high", "critical"].map((p) => ({
    priority: p[0].toUpperCase() + p.slice(1),
    Pending: tasks.filter((t) => t.priority === p && t.status !== "completed").length,
    Completed: tasks.filter((t) => t.priority === p && t.status === "completed").length,
  }));

  return (
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Live snapshot of every project, person, and deadline. Click any card to navigate.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
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
              search={{ status: "completed" }}
            />
            <Metric
              icon={PauseCircle}
              label="On Hold Projects"
              value={onHold}
              tone="muted"
              to="/projects"
              search={{ status: "on_hold" }}
            />
            <Metric
              icon={AlertTriangle}
              label="Delayed"
              value={delayed}
              tone="warning"
              to="/projects"
              search={{ status: "delayed" }}
            />
            <Metric
              icon={Users}
              label="Employees"
              value={employees}
              sub={`${activeEmployees} active`}
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
                <h3 className="font-semibold">Project Status</h3>
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
                <h3 className="font-semibold">Tasks by Priority</h3>
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
        ) : data?.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No projects yet. Create one from the Projects page.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {data?.recent.map((p) => (
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
                <div className="w-24 sm:w-32 hidden sm:block shrink-0">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.progress}%</p>
                </div>
                <Badge variant="secondary" className={`${statusColor(p.status)} shrink-0`}>
                  {statusLabel(p.status)}
                </Badge>
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
