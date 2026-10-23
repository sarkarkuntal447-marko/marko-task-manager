import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { listActivity, listDailyLogs, createDailyLog } from "@/lib/app.functions";
import { listProjects } from "@/lib/projects.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Activity as ActivityIcon,
  FolderPlus,
  UserPlus,
  UserMinus,
  CheckCircle2,
  ListTodo,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { statusLabel, statusColor, priorityColor, fmtDate } from "@/lib/format";
import { ListRowsSkeleton } from "@/components/skeletons";

type LogPriority = "low" | "medium" | "high" | "critical";
type LogStatus = "pending" | "in_progress" | "blocked" | "testing" | "completed";
type ProjectOption = { id: string; name: string };
type ActivityEntry = {
  id: string;
  action: string;
  entity_name?: string | null;
  actor_name?: string | null;
  metadata?: Record<string, unknown>;
  created_at: string;
};
type DailyLogEntry = {
  id: string;
  task_name: string;
  log_date?: string | null;
  priority?: string | null;
  status?: string | null;
  notes?: string | null;
  hours?: number | null;
  projects?: { name?: string | null } | null;
  profiles?: { full_name?: string | null; email?: string | null } | null;
};
type LogFormState = {
  log_date: string;
  task_name: string;
  project_id: string;
  priority: LogPriority;
  status: LogStatus;
  hours: string;
  notes: string;
};

const PRIORITY_VALUES: LogPriority[] = ["low", "medium", "high", "critical"];
const STATUS_VALUES: LogStatus[] = ["pending", "in_progress", "blocked", "testing", "completed"];

export const Route = createFileRoute("/_authenticated/logs")({
  head: () => ({ meta: [{ title: "Daily Logs — Marko Projects" }] }),
  component: LogsPage,
});

function LogsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(false);

  // Cutoff: start of yesterday (so today + previous day are included)
  const recentCutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  })();

  const { data: activity = [], isLoading: activityLoading } = useQuery<ActivityEntry[]>({
    queryKey: ["activity-log", showAll],
    queryFn: async () => {
      const result = await listActivity({
        data: showAll ? { limit: 500 } : { since: recentCutoff },
      });
      return result as ActivityEntry[];
    },
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery<DailyLogEntry[]>({
    queryKey: ["daily-logs", showAll],
    queryFn: async () => {
      const todayStr = new Date().toISOString().slice(0, 10);
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().slice(0, 10);
      const result = await listDailyLogs({
        data: showAll ? {} : { dates: [todayStr, yestStr] },
      });
      return result as DailyLogEntry[];
    },
  });

  const { data: projects = [] } = useQuery<ProjectOption[]>({
    queryKey: ["projects-min"],
    queryFn: async () => {
      const data = await listProjects();
      return (data as Array<{ id: string; name: string }>).map((p) => ({
        id: p.id,
        name: p.name,
      }));
    },
  });

  const filteredActivity = activity.filter(
    (a: ActivityEntry) =>
      !q ||
      `${a.action} ${a.entity_name ?? ""} ${a.actor_name ?? ""}`
        .toLowerCase()
        .includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Daily Logs</h1>
          <p className="text-muted-foreground">
            Everything that happens across the workspace, in real time.
          </p>
        </div>
        <NewLogDialog
          projects={projects}
          onAdded={() => qc.invalidateQueries({ queryKey: ["daily-logs"] })}
        />
      </div>

      <Input
        placeholder="Search…"
        className="max-w-sm"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="manual">Manual Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-2">
          <Card className="p-6">
            {activityLoading ? (
              <ListRowsSkeleton rows={5} />
            ) : filteredActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-2">
                {filteredActivity.map((a) => (
                  <ActivityRow key={a.id} a={a} />
                ))}
              </ul>
            )}
            {!showAll && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                  See older activity
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="manual" className="space-y-2">
          <Card className="p-6">
            {logsLoading ? (
              <ListRowsSkeleton rows={5} />
            ) : logs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No manual logs yet.</p>
            ) : (
              <div className="space-y-2">
                {logs
                  .filter(
                    (l: DailyLogEntry) =>
                      !q ||
                      `${l.task_name} ${l.projects?.name ?? ""} ${l.profiles?.full_name ?? ""}`
                        .toLowerCase()
                        .includes(q.toLowerCase()),
                  )
                  .map((l) => (
                    <div
                      key={l.id}
                      className="p-3 rounded-lg border border-border flex flex-wrap items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{l.task_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(l.log_date)}
                          {l.projects?.name && ` · ${l.projects.name}`}
                          {l.profiles && ` · ${l.profiles.full_name ?? l.profiles.email}`}
                          {l.hours && ` · ${l.hours}h`}
                        </p>
                        {l.notes && <p className="text-xs text-muted-foreground mt-1">{l.notes}</p>}
                      </div>
                      <Badge variant="secondary" className={priorityColor(l.priority)}>
                        {l.priority}
                      </Badge>
                      <Badge variant="secondary" className={statusColor(l.status)}>
                        {statusLabel(l.status)}
                      </Badge>
                    </div>
                  ))}
              </div>
            )}
            {!showAll && (
              <div className="flex justify-center mt-4">
                <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>
                  See older logs
                </Button>
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActivityRow({ a }: { a: ActivityEntry }) {
  const { icon, text } = describeActivity(a);
  return (
    <li className="flex items-start gap-3 p-2.5 rounded-lg border border-border bg-card">
      <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center shrink-0 text-accent-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">{text}</p>
        <p className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</p>
      </div>
    </li>
  );
}

function describeActivity(a: ActivityEntry): { icon: ReactNode; text: ReactNode } {
  const who = a.actor_name ?? "Someone";
  switch (a.action) {
    case "project.created":
      return {
        icon: <FolderPlus className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> created project <b>{a.entity_name}</b>
          </>
        ),
      };
    case "member.removed":
      return {
        icon: <UserMinus className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> removed <b>{a.entity_name}</b> from the workspace
          </>
        ),
      };
    case "member.joined":
      return {
        icon: <UserPlus className="h-4 w-4" />,
        text: (
          <>
            <b>{a.entity_name}</b> joined the workspace
          </>
        ),
      };
    case "task.created":
      return {
        icon: <ListTodo className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> added task <b>{a.entity_name}</b>
          </>
        ),
      };
    case "task.status_changed": {
      const to =
        typeof a.metadata === "object" && a.metadata !== null && "to" in a.metadata
          ? a.metadata.to
          : undefined;
      const statusText = typeof to === "string" ? statusLabel(to) : "status";
      return {
        icon:
          to === "completed" ? (
            <CheckCircle2 className="h-4 w-4 text-success" />
          ) : (
            <ActivityIcon className="h-4 w-4" />
          ),
        text: (
          <>
            <b>{who}</b> moved <b>{a.entity_name}</b> to <b>{statusText}</b>
          </>
        ),
      };
    }
    case "role.assigned":
      return {
        icon: <ShieldCheck className="h-4 w-4" />,
        text: (
          <>
            <b>{who}</b> assigned role <b>{a.metadata?.role}</b> to <b>{a.entity_name}</b>
          </>
        ),
      };
    default:
      return {
        icon: <ActivityIcon className="h-4 w-4" />,
        text: (
          <>
            {a.action} — {a.entity_name}
          </>
        ),
      };
  }
}

function NewLogDialog({ projects, onAdded }: { projects: ProjectOption[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<LogFormState>({
    log_date: new Date().toISOString().slice(0, 10),
    task_name: "",
    project_id: "",
    priority: "medium",
    status: "in_progress",
    hours: "",
    notes: "",
  });
  const m = useMutation({
    mutationFn: async () => {
      await createDailyLog({
        data: {
          log_date: form.log_date,
          task_name: form.task_name,
          project_id: form.project_id || null,
          priority: form.priority,
          status: form.status,
          hours: form.hours ? Number(form.hours) : null,
          notes: form.notes || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Logged");
      onAdded();
      setOpen(false);
      setForm((f) => ({ ...f, task_name: "", hours: "", notes: "" }));
    },
    onError: (error: unknown) => {
      toast.error(error instanceof Error ? error.message : "Unable to save log.");
    },
  });

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4 mr-2" />
        Log Work
      </Button>
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <Card className="w-full max-w-lg p-6 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">Log Today's Work</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={form.log_date}
                  onChange={(e) => setForm({ ...form, log_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Hours</Label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Task *</Label>
              <Input
                value={form.task_name}
                onChange={(e) => setForm({ ...form, task_name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Project</Label>
              <Select
                value={form.project_id}
                onValueChange={(v) => setForm({ ...form, project_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={form.priority}
                  onValueChange={(v) => setForm({ ...form, priority: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["low", "medium", "high", "critical"].map((p) => (
                      <SelectItem key={p} value={p}>
                        {statusLabel(p)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["pending", "in_progress", "blocked", "testing", "completed"].map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusLabel(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!form.task_name || m.isPending} onClick={() => m.mutate()}>
                Save Log
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}