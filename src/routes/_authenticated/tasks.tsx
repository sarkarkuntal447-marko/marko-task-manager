import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  deleteTask,
  listMyTasks,
  listTaskProjects,
  listTeamTasks,
  updateTask,
} from "@/lib/app.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, ListTodo, X } from "lucide-react";
import { toast } from "sonner";
import { statusLabel } from "@/lib/format";
import { TASK_STATUSES, type TaskStatus } from "@/lib/types";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ListRowsSkeleton } from "@/components/skeletons";
import { TaskFormDialog } from "@/components/task-form-dialog";
import { TaskTable, type TaskRow } from "@/components/task-table";

export const Route = createFileRoute("/_authenticated/tasks")({
  head: () => ({ meta: [{ title: "Tasks — Marko Projects" }] }),
  component: TasksPage,
});

type Filters = { q: string; status: string; date: string };
const noFilters: Filters = { q: "", status: "all", date: "" };

const applyFilters = <T extends TaskRow>(tasks: T[], f: Filters) => {
  const q = f.q.trim().toLowerCase();
  return tasks.filter(
    (t) =>
      (f.status === "all" || t.status === f.status) &&
      (!f.date || t.task_date === f.date) &&
      (!q || `${t.name} ${t.notes ?? ""} ${t.project_name ?? ""}`.toLowerCase().includes(q)),
  );
};

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function TasksPage() {
  const { data: me } = useCurrentUser();
  // Admins and super admins also see the tasks of the people in their department.
  const isAdmin = me?.role === "Admin" || me?.role === "Super_Admin";

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Tasks</h1>
        <p className="text-muted-foreground">Log what you work on each day, one line per task.</p>
      </div>
      {isAdmin ? (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine">My Tasks</TabsTrigger>
            <TabsTrigger value="team">Team Tasks</TabsTrigger>
          </TabsList>
          <TabsContent value="mine" className="space-y-4">
            <MyTasks />
          </TabsContent>
          <TabsContent value="team" className="space-y-4">
            <TeamTasks department={me?.profile?.department ?? null} />
          </TabsContent>
        </Tabs>
      ) : (
        <MyTasks />
      )}
    </div>
  );
}

function MyTasks() {
  const qc = useQueryClient();
  const [filters, setFilters] = useState(noFilters);
  const [editing, setEditing] = useState<TaskRow | "new" | null>(null);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: () => listMyTasks(),
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["task-projects"],
    queryFn: () => listTaskProjects(),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-tasks"] });
    qc.invalidateQueries({ queryKey: ["ongoing-tasks"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const changeStatus = useMutation({
    mutationFn: (v: { id: string; status: TaskStatus }) =>
      updateTask({ data: { id: v.id, changes: { status: v.status } } }),
    onSuccess: () => {
      toast.success("Status updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteTask({ data: { id } }),
    onSuccess: () => {
      toast.success("Task deleted");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const shown = applyFilters(tasks, filters);

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <TaskFilters value={filters} onChange={setFilters} />
        <Button className="ml-auto" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-2" />
          Add Task
        </Button>
      </div>
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-6">
            <ListRowsSkeleton rows={4} />
          </div>
        ) : shown.length === 0 ? (
          <EmptyTasks
            text={tasks.length ? "No tasks match these filters." : "No tasks logged yet."}
          />
        ) : (
          <TaskTable
            tasks={shown}
            onStatusChange={(t, status) => changeStatus.mutate({ id: t.id, status })}
            onEdit={(t) => setEditing(t)}
            onDelete={(t) => {
              if (window.confirm("Delete this task? This cannot be undone.")) remove.mutate(t.id);
            }}
          />
        )}
      </Card>
      {editing && (
        <TaskFormDialog
          task={editing === "new" ? undefined : editing}
          projects={projects}
          onOpenChange={(o) => !o && setEditing(null)}
          onSaved={refresh}
        />
      )}
    </>
  );
}

function TeamTasks({ department }: { department: string | null }) {
  const [filters, setFilters] = useState(noFilters);
  const [member, setMember] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["team-tasks"],
    queryFn: () => listTeamTasks(),
  });
  const members = data?.members ?? [];
  const tasks = applyFilters(data?.tasks ?? [], filters);

  // One section per person, in name order; people with nothing matching are left out.
  const groups = members
    .filter((m) => member === "all" || m.id === member)
    .map((m) => ({ member: m, items: tasks.filter((t) => t.assigned_to === m.id) }))
    .filter((g) => g.items.length > 0);

  if (!isLoading && !department)
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Your department is not set, so no team tasks are shown. Ask a super admin to set it on your
        team profile.
      </Card>
    );

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Select value={member} onValueChange={setMember}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All members</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.id} value={m.id}>
                {m.full_name ?? "Team member"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <TaskFilters value={filters} onChange={setFilters} />
        <p className="text-xs text-muted-foreground ml-auto">
          Showing {department === "Tech & SEO" ? "Tech and SEO" : department} team members
        </p>
      </div>
      {isLoading ? (
        <Card className="p-6">
          <ListRowsSkeleton rows={4} />
        </Card>
      ) : groups.length === 0 ? (
        <Card>
          <EmptyTasks
            text={
              !members.length
                ? "No team members to show yet."
                : !data?.tasks.length
                  ? "Your team has not logged any tasks yet."
                  : "No tasks match these filters."
            }
          />
        </Card>
      ) : (
        groups.map(({ member: m, items }) => (
          <Card key={m.id} className="overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initialsOf(m.full_name ?? "U")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-medium truncate">{m.full_name ?? "Team member"}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[m.designation, m.department].filter(Boolean).join(" · ")}
                </p>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {items.length} {items.length === 1 ? "task" : "tasks"}
              </Badge>
            </div>
            <TaskTable tasks={items} />
          </Card>
        ))
      )}
    </>
  );
}

function TaskFilters({ value, onChange }: { value: Filters; onChange: (f: Filters) => void }) {
  const active = value.q || value.status !== "all" || value.date;
  return (
    <>
      <Input
        placeholder="Search tasks…"
        value={value.q}
        onChange={(e) => onChange({ ...value, q: e.target.value })}
        className="w-full sm:w-56"
      />
      <Select value={value.status} onValueChange={(v) => onChange({ ...value, status: v })}>
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All status</SelectItem>
          {TASK_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {statusLabel(s)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="w-full sm:w-44">
        <DatePicker
          value={value.date}
          onChange={(v) => onChange({ ...value, date: v })}
          placeholder="Any date"
        />
      </div>
      {active && (
        <Button variant="ghost" size="sm" onClick={() => onChange(noFilters)}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </>
  );
}

function EmptyTasks({ text }: { text: string }) {
  return (
    <div className="p-12 text-center">
      <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
