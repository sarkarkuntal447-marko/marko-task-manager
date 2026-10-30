import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { listProjects, createProject, type ProjectInput } from "@/lib/projects.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, FolderKanban, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { statusLabel, statusColor, priorityColor, maintenableColor, fmtDate } from "@/lib/format";
import { NewTaskDialog } from "@/components/new-task-dialog";
import { GanttChart } from "@/components/gantt-chart";
import { ArchivedProjects } from "@/components/archived-projects";
import { ProjectsListSkeleton } from "@/components/skeletons";
import { useCurrentUser, canManageProjects } from "@/hooks/use-current-user";

type ProjectSearch = {
  status?: string;
};

export const Route = createFileRoute("/_authenticated/projects/")({
  validateSearch: (search: Record<string, unknown>): ProjectSearch => ({
    status: typeof search.status === "string" ? search.status : undefined,
  }),
  head: () => ({ meta: [{ title: "Projects — Marko Projects" }] }),
  component: ProjectsPage,
});

const STATUSES = [
  "planning",
  "requirement_gathering",
  "design",
  "development",
  "api_integration",
  "crm_integration",
  "testing",
  "deployment",
  "client_review",
  "maintenance",
  "completed",
  "on_hold",
  "cancelled",
];
const PRIORITIES = ["low", "medium", "high", "critical"];

function ProjectsPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const canManage = canManageProjects(me?.role);
  // Every signed-in user (including super admin) can add a task.
  const canAdd = !!me;
  const [open, setOpen] = useState(false);
  const search = Route.useSearch();
  const [filter, setFilter] = useState<string>(search.status || "all");
  useEffect(() => {
    if (search.status) setFilter(search.status);
  }, [search.status]);
  const [q, setQ] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => listProjects(),
  });

  const create = useMutation({
    mutationFn: async (input: ProjectInput) => {
      await createProject({ data: input });
    },
    onSuccess: () => {
      toast.success("Project created");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const ql = q.trim().toLowerCase();
  const filtered = projects
    .filter((p) => {
      if (filter === "all") return true;
      if (filter === "active") return !["completed", "on_hold", "cancelled"].includes(p.status);
      if (filter === "delayed")
        return p.progress < 100 && !["completed", "cancelled"].includes(p.status);
      return p.status === filter;
    })
    .filter(
      (p) =>
        !ql ||
        `${p.name} ${p.description ?? ""} ${p.client_name ?? ""} ${p.client_company ?? ""}`
          .toLowerCase()
          .includes(ql),
    );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground">All client projects, phases, and progress.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Input
            placeholder="Search projects…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-64"
          />
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="active">Active projects</SelectItem>
              <SelectItem value="delayed">Delayed projects</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canAdd && (
            <NewTaskDialog
              projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              onAdded={() => qc.invalidateQueries({ queryKey: ["all-tasks"] })}
            />
          )}
          {/* Every signed-in user can create a project. */}
          {canAdd && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <NewProjectDialog onSubmit={(v) => create.mutate(v)} loading={create.isPending} />
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <ProjectsListSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
          <h3 className="font-semibold">No projects yet</h3>
          <p className="text-sm text-muted-foreground">Create your first project to get started.</p>
        </Card>
      ) : (
        <>
          <Card className="p-6">
            <h2 className="font-semibold mb-4">Project Timeline</h2>
            <GanttChart
              items={filtered.map((p) => ({
                id: p.id,
                label: p.name,
                sublabel: statusLabel(p.status),
                start: p.start_date,
                end: p.expected_delivery_date ?? p.actual_delivery_date,
                progress: p.progress,
                done: p.status === "completed",
                onClick: () => navigate({ to: "/projects/$id", params: { id: p.id } }),
              }))}
            />
          </Card>
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center">Project</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Priority</TableHead>
                  <TableHead className="hidden sm:table-cell text-center">Maintenance</TableHead>
                  <TableHead className="hidden sm:table-cell">Progress</TableHead>
                  <TableHead className="hidden md:table-cell">Due Date</TableHead>
                  <TableHead className="hidden lg:table-cell">Client</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() => navigate({ to: "/projects/$id", params: { id: p.id } })}
                  >
                    <TableCell>
                      <div className="font-medium">{p.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-xs">
                        {p.description || "No description"}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className={statusColor(p.status)}>
                        {statusLabel(p.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className={priorityColor(p.priority)}>
                        {p.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-center">
                      <Badge variant="secondary" className={maintenableColor(p.isMaintenable)}>
                        {p.isMaintenable ? "Yes" : "No"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <div className="w-full max-w-[140px]">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>{p.progress}%</span>
                        </div>
                        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${p.progress}%` }} />
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                      {fmtDate(p.expected_delivery_date)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {p.client_name || "—"}
                    </TableCell>
                    <TableCell>
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}

      <ArchivedProjects />
    </div>
  );
}

function NewProjectDialog({
  onSubmit,
  loading,
}: {
  onSubmit: (v: ProjectInput) => void;
  loading: boolean;
}) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    client_name: "",
    client_company: "",
    client_email: "",
    client_phone: "",
    start_date: "",
    expected_delivery_date: "",
    status: "planning",
    priority: "medium",
    technology_stack: "",
    notes: "",
  });
  const update = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>New Project</DialogTitle>
      </DialogHeader>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 space-y-2">
          <Label>Project Name *</Label>
          <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label>Client Name</Label>
          <Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>Client Company</Label>
          <Input
            value={form.client_company}
            onChange={(e) => update("client_company", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Client Email</Label>
          <Input
            type="email"
            value={form.client_email}
            onChange={(e) => update("client_email", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Client Phone</Label>
          <Input
            value={form.client_phone}
            onChange={(e) => update("client_phone", e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Start Date</Label>
          <DatePicker value={form.start_date} onChange={(v) => update("start_date", v)} />
        </div>
        <div className="space-y-2">
          <Label>Expected Delivery</Label>
          <DatePicker
            value={form.expected_delivery_date}
            onChange={(v) => update("expected_delivery_date", v)}
          />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => update("status", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {statusLabel(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 space-y-2">
          <Label>Tech Stack (comma separated)</Label>
          <Input
            value={form.technology_stack}
            onChange={(e) => update("technology_stack", e.target.value)}
            placeholder="React, Node, Postgres"
          />
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!form.name || loading}
          onClick={() =>
            onSubmit({
              ...form,
              start_date: form.start_date || null,
              expected_delivery_date: form.expected_delivery_date || null,
              technology_stack: form.technology_stack
                ? form.technology_stack
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean)
                : null,
            })
          }
        >
          Create Project
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
