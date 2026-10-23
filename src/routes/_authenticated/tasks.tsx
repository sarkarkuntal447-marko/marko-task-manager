import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { listAllTasks, getTeamDirectory, updateTask, deleteTask } from "@/lib/app.functions";
import { listProjects } from "@/lib/projects.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { statusLabel, statusColor, priorityColor, fmtDate } from "@/lib/format";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { ListRowsSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Marko Projects" }] }),
  component: TasksPage,
});

const STATUSES = ["pending", "in_progress", "blocked", "testing", "completed"] as const;
const PRIORITIES = ["low", "medium", "high", "critical"] as const;

function TasksPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const canEditAll = me?.role === "super_admin" || me?.role === "admin" || me?.role === "moderator";
  // Only-super-admin cannot add. Anyone with another role (even alongside super_admin) can.
  const roles = me?.roles ?? [];
  const canAdd = !!me && (roles.length === 0 || roles.some((r) => r !== "super_admin"));

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["all-tasks"],
    queryFn: () => listAllTasks(),
  });

  const { data: directory = [] } = useQuery({
    queryKey: ["team-directory"],
    queryFn: () => getTeamDirectory(),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-min"],
    queryFn: async () => {
      const data = await listProjects();
      return data.map((p: any) => ({ id: p.id, name: p.name }));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      await updateTask({ data: { id: taskId, changes: { status: status as any } } });
    },
    onSuccess: () => { toast.success("Status updated"); qc.invalidateQueries({ queryKey: ["all-tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeTask = useMutation({
    mutationFn: async (taskId: string) => {
      await deleteTask({ data: { id: taskId } });
    },
    onSuccess: () => { toast.success("Task removed"); qc.invalidateQueries({ queryKey: ["all-tasks"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);

  const nameFor = (uid?: string | null) => {
    if (!uid) return "Unassigned";
    const p: any = directory.find((d: any) => d.id === uid);
    return p?.full_name ?? "Team member";
  };

  // Group by assignee
  const { todayGroups, previousGroups } = useMemo(() => {
    const isToday = (t: any) => (t.created_at ?? "").slice(0, 10) === today || t.due_date === today;
    const groupByOwner = (list: any[]) => {
      const map = new Map<string, { name: string; ownerId: string; items: any[] }>();
      for (const t of list) {
        const owner = t.assigned_to ?? t.created_by ?? "unassigned";
        const name = nameFor(owner);
        if (!map.has(owner)) map.set(owner, { name, ownerId: owner, items: [] });
        map.get(owner)!.items.push(t);
      }
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    };
    return {
      todayGroups: groupByOwner(tasks.filter(isToday)),
      previousGroups: groupByOwner(tasks.filter((t: any) => !isToday(t))),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, directory]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">Today's task lists, grouped by team member. History is collapsed below.</p>
        </div>
        {canAdd && <NewTaskDialog projects={projects} onAdded={() => qc.invalidateQueries({ queryKey: ["all-tasks"] })} />}
      </div>

      <Card className="p-6 border-primary/40 bg-primary/[0.04]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Today · {fmtDate(today)}</h2>
          <Badge variant="secondary">{todayGroups.reduce((n, g) => n + g.items.length, 0)} tasks</Badge>
        </div>
        {isLoading ? (
          <ListRowsSkeleton rows={3} />
        ) : todayGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks logged today yet.</p>
        ) : (
          <div className="space-y-4">
            {todayGroups.map((g) => (
              <MemberGroup
                key={g.ownerId}
                name={g.name}
                items={g.items}
                me={me}
                canEditAll={!!canEditAll}
                onStatus={(id: string, s: string) => updateStatus.mutate({ taskId: id, status: s })}
                onDelete={(id: string) => removeTask.mutate(id)}
              />
            ))}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Previous Tasks</h2>
          <Badge variant="secondary">{previousGroups.reduce((n, g) => n + g.items.length, 0)} tasks</Badge>
        </div>
        {isLoading ? (
          <ListRowsSkeleton rows={3} />
        ) : previousGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">No prior tasks.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {previousGroups.map((g) => (
              <AccordionItem key={g.ownerId} value={g.ownerId}>
                <AccordionTrigger>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
                        {g.name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{g.name}</span>
                    <Badge variant="secondary">{g.items.length}</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {g.items.map((t: any) => (
                      <TaskRow key={t.id} t={t} me={me} canEditAll={!!canEditAll}
                        onStatus={(s: string) => updateStatus.mutate({ taskId: t.id, status: s })}
                        onDelete={() => removeTask.mutate(t.id)} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </Card>
    </div>
  );
}

function MemberGroup({ name, items, me, canEditAll, onStatus, onDelete }: any) {
  const initials = name.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="h-7 w-7">
          <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <p className="font-medium">{name}</p>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <div className="space-y-2">
        {items.map((t: any) => (
          <TaskRow key={t.id} t={t} me={me} canEditAll={canEditAll}
            onStatus={(s: string) => onStatus(t.id, s)}
            onDelete={() => onDelete(t.id)} />
        ))}
      </div>
    </div>
  );
}

function TaskRow({ t, me, canEditAll, onStatus, onDelete }: any) {
  const qc = useQueryClient();
  const canEditThis = canEditAll || t.assigned_to === me?.user.id || t.created_by === me?.user.id;
  const canDeleteThis = canEditAll || t.created_by === me?.user.id;
  return (
    <div className="p-3 rounded-lg border border-border bg-card flex flex-col sm:flex-row sm:items-center sm:flex-wrap gap-2 sm:gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-medium break-words">{t.name}</p>
        <p className="text-xs text-muted-foreground break-words">
          {fmtDate((t.created_at ?? "").slice(0, 10))}
          {t.projects?.name && ` · ${t.projects.name}`}
          {t.phase?.name && ` · ${t.phase.name}`}
          {t.due_date && ` · due ${fmtDate(t.due_date)}`}
        </p>
        {t.description && <p className="text-xs text-muted-foreground mt-1 break-words">{t.description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className={priorityColor(t.priority)}>{t.priority}</Badge>
        {canEditThis ? (
          <Select value={t.status} onValueChange={onStatus}>
            <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant="secondary" className={statusColor(t.status)}>{statusLabel(t.status)}</Badge>
        )}
        {canEditThis && (
          <EditTaskDialog task={t} onSaved={() => qc.invalidateQueries({ queryKey: ["all-tasks"] })} />
        )}
        {canDeleteThis && (
          <Button variant="ghost" size="icon" onClick={onDelete} title="Delete">
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

function EditTaskDialog({ task, onSaved }: { task: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: task.name ?? "",
    description: task.description ?? "",
    priority: task.priority ?? "medium",
    status: task.status ?? "pending",
    due_date: task.due_date ?? "",
  });
  const m = useMutation({
    mutationFn: async () => {
      await updateTask({
        data: {
          id: task.id, changes: {
            name: form.name,
            description: form.description || null,
            priority: form.priority as any,
            status: form.status as any,
            due_date: form.due_date || null,
          }
        }
      });
    },
    onSuccess: () => { toast.success("Task updated"); onSaved(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit task"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Task *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Due</Label><DatePicker value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} /></div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{statusLabel(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}