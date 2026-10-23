import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDashboard } from "@/lib/app.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, CheckCircle2, Clock, AlertTriangle, Users, ListTodo, TrendingUp, PauseCircle,
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import { statusLabel, statusColor, fmtDate } from "@/lib/format";
import { MetricCardSkeleton, ChartCardSkeleton, ListRowsSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — Marko Projects" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const d = await getDashboard();
      return { ...d, recent: d.projects.slice(0, 6) };
    },
  });

  const projects = data?.projects ?? [];
  const tasks = data?.tasks ?? [];
  const profiles = data?.profiles ?? [];

  const total = projects.length;
  const active = projects.filter((p) => !["completed", "on_hold", "cancelled"].includes(p.status)).length;
  const completed = projects.filter((p) => p.status === "completed").length;
  const onHold = projects.filter((p) => p.status === "on_hold").length;
  const delayed = projects.filter((p) => p.progress < 100 && !["completed", "cancelled"].includes(p.status)).length;

  const pendingTasks = tasks.filter((t) => t.status !== "completed").length;
  const completedTasks = tasks.filter((t) => t.status === "completed").length;

  const employees = profiles.length;
  const activeEmployees = profiles.filter((p) => p.availability === "available" || p.availability === "busy").length;

  const statusCounts = projects.reduce<Record<string, number>>((a, p) => {
    a[p.status] = (a[p.status] ?? 0) + 1; return a;
  }, {});
  const pieData = Object.entries(statusCounts).map(([k, v]) => ({ name: statusLabel(k), value: v }));
  const COLORS = ["hsl(259 70% 55%)", "hsl(155 50% 50%)", "hsl(75 70% 55%)", "hsl(25 75% 55%)", "hsl(230 60% 55%)", "hsl(320 50% 55%)"];

  const taskByPriority = ["low", "medium", "high", "critical"].map((p) => ({
    priority: p[0].toUpperCase() + p.slice(1),
    Pending: tasks.filter((t) => t.priority === p && t.status !== "completed").length,
    Completed: tasks.filter((t) => t.priority === p && t.status === "completed").length,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Live snapshot of every project, person, and deadline.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 8 }).map((_, i) => <MetricCardSkeleton key={i} />)
        ) : (
          <>
            <Metric icon={FolderKanban} label="Total Projects" value={total} tone="primary" />
            <Metric icon={TrendingUp} label="Active" value={active} tone="info" />
            <Metric icon={CheckCircle2} label="Completed" value={completed} tone="success" />
            <Metric icon={PauseCircle} label="On Hold" value={onHold} tone="muted" />
            <Metric icon={AlertTriangle} label="Delayed" value={delayed} tone="warning" />
            <Metric icon={Users} label="Employees" value={employees} sub={`${activeEmployees} active`} tone="primary" />
            <Metric icon={ListTodo} label="Pending Tasks" value={pendingTasks} tone="info" />
            <Metric icon={Clock} label="Completed Tasks" value={completedTasks} tone="success" />
          </>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <ChartCardSkeleton className="lg:col-span-1" />
            <ChartCardSkeleton className="lg:col-span-2" />
          </>
        ) : (
          <>
            <Card className="p-6 lg:col-span-1">
              <h3 className="font-semibold mb-4">Project Status</h3>
              <div className="h-64">
                {pieData.length === 0 ? (
                  <EmptyChart label="No projects yet" />
                ) : (
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </Card>

            <Card className="p-6 lg:col-span-2">
              <h3 className="font-semibold mb-4">Tasks by Priority</h3>
              <div className="h-64">
                <ResponsiveContainer>
                  <BarChart data={taskByPriority}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="priority" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
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

      <Card className="p-6">
        <h3 className="font-semibold mb-4">Recent Projects</h3>
        {isLoading ? (
          <ListRowsSkeleton rows={4} />
        ) : data?.recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">No projects yet. Create one from the Projects page.</p>
        ) : (
          <div className="divide-y divide-border">
            {data?.recent.map((p) => (
              <div key={p.id} className="py-3 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate">Due {fmtDate(p.expected_delivery_date)}</p>
                </div>
                <div className="w-32 hidden md:block">
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{p.progress}%</p>
                </div>
                <Badge variant="secondary" className={statusColor(p.status)}>{statusLabel(p.status)}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function Metric({ icon: Icon, label, value, sub, tone }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string;
  tone: "primary" | "success" | "warning" | "info" | "muted";
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning-foreground",
    info: "bg-info/15 text-info",
    muted: "bg-muted text-muted-foreground",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${toneClass[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-bold leading-none mt-1">{value}</p>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        </div>
      </div>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return <div className="h-full flex items-center justify-center text-sm text-muted-foreground">{label}</div>;
}