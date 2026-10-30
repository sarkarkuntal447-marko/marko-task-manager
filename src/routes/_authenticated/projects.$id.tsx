import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getTeamDirectory } from "@/lib/app.functions";
import {
  type ProjectInput,
  getProject,
  updateProject,
  listProjectPhases,
  createProjectPhase,
  updateProjectPhase,
  deleteProjectPhase,
  seedProjectPhases,
  listOngoingTasks,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
} from "@/lib/projects.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ChevronRight,
  ArrowLeft,
  Plus,
  Trash2,
  Calendar,
  Users,
  Pencil,
  Crown,
  UserPlus,
  X,
  ListTodo,
} from "lucide-react";
import { toast } from "sonner";
import { ProjectTimeline } from "@/components/project-timeline";
import { TaskTable } from "@/components/task-table";
import { ProjectDetailSkeleton, ListRowsSkeleton } from "@/components/skeletons";
import { statusLabel, statusColor, priorityColor, fmtDate } from "@/lib/format";
import {
  PROJECT_TYPE_LABEL,
  canWorkOn,
  defaultPhasesFor,
  projectTypeOf,
  statusesFor,
} from "@/lib/project-status";
import { useCurrentUser, canManageProjects } from "@/hooks/use-current-user";
import type { PhaseDoc, ProjectDoc, Priority, PhaseStatus } from "@/lib/types";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [{ title: "Project — Marko Projects" }] }),
  component: ProjectDetail,
});

const PRIORITIES = ["low", "medium", "high", "critical"];
const PHASE_STATUSES = ["not_started", "in_progress", "completed", "blocked"];

type TeamMember = Awaited<ReturnType<typeof getTeamDirectory>>[number];

const initialsOf = (name: string) =>
  name
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function ProjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const canManage = canManageProjects(me?.role);

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });

  const { data: phases = [], error: phasesError } = useQuery({
    queryKey: ["phases", id],
    queryFn: () => listProjectPhases({ data: { projectId: id } }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => getTeamDirectory(),
  });

  const { data: ongoingTasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ["ongoing-tasks", id],
    queryFn: () => listOngoingTasks({ data: { projectId: id } }),
  });

  const { data: projectMembers = [], error: membersError } = useQuery({
    queryKey: ["project-members", id],
    queryFn: () => listProjectMembers({ data: { projectId: id } }),
  });

  const recomputeProgress = async () => {
    // MongoDB reads calculate progress from the current phase records.
    await qc.invalidateQueries({ queryKey: ["project", id] });
    await qc.invalidateQueries({ queryKey: ["projects"] });
  };

  const seedPhases = useMutation({
    mutationFn: () => seedProjectPhases({ data: { projectId: id } }),

    onSuccess: () => {
      toast.success("Default phases added");
      qc.invalidateQueries({ queryKey: ["phases", id] });
      recomputeProgress();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePhase = useMutation({
    mutationFn: ({ phaseId, completed }: { phaseId: string; completed: boolean }) =>
      updateProjectPhase({
        data: {
          projectId: id,
          phaseId,
          changes: { status: completed ? "completed" : "in_progress" },
        },
      }),

    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["phases", id] });
      await recomputeProgress();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhase = useMutation({
    mutationFn: (phaseId: string) => deleteProjectPhase({ data: { projectId: id, phaseId } }),

    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["phases", id] });
      await recomputeProgress();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) =>
      updateProject({ data: { id, changes: { status: status as ProjectInput["status"] } } }),

    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Status updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveProjectChange = async (changes: Partial<ProjectInput>, message: string) => {
    try {
      await updateProject({ data: { id, changes } });
      qc.invalidateQueries({ queryKey: ["project", id] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success(message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save project.");
    }
  };

  if (projectLoading) return <ProjectDetailSkeleton />;
  if (projectError)
    return (
      <div className="p-8 text-destructive">
        {projectError instanceof Error ? projectError.message : "Unable to load project."}
      </div>
    );
  if (!project) return <div className="p-8">Project not found.</div>;

  const safeMembers = Array.isArray(members) ? members : [];
  const safeProjectMembers = Array.isArray(projectMembers) ? projectMembers : [];
  const safePhases = Array.isArray(phases) ? phases : [];
  // Open phases first, then by end date (earliest first); phases without an end date go last.
  const orderedPhases = [...safePhases].sort(
    (a, b) =>
      Number(a.completed) - Number(b.completed) ||
      (a.end_date ?? "9999-12-31").localeCompare(b.end_date ?? "9999-12-31"),
  );
  const memberIds = safeProjectMembers.map((m) => m.user_id).filter(Boolean);
  const workingMembers = safeMembers.filter((m) => memberIds.includes(m.id));
  // Members assigned to this project may add phases and edit it, alongside admins.
  const canEditProject = canManage || (!!me?.user.id && memberIds.includes(me.user.id));
  const sto = safeMembers.find((m) => m.id === project.lead_id);
  const projectType = projectTypeOf(project);
  // Tech projects are staffed by Tech people, SEO projects by SEO people.
  const eligibleMembers = safeMembers.filter((m) => canWorkOn(projectType, m.department));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link
        to="/projects"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold break-words min-w-0">{project.name}</h1>
            <Badge variant="outline">{PROJECT_TYPE_LABEL[projectType]}</Badge>
            <Badge variant="secondary" className={priorityColor(project.priority)}>
              {project.priority}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl break-words">{project.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {canEditProject && (
            <>
              <EditProjectDialog
                project={project}
                onSaved={() => {
                  qc.invalidateQueries({ queryKey: ["project", id] });
                  qc.invalidateQueries({ queryKey: ["projects"] });
                }}
              />
              <Select value={project.status} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="w-full sm:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusesFor(projectType).map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Progress</p>
          <p className="text-4xl font-bold mt-1">{project.progress}%</p>
          <div className="h-2 bg-muted rounded-full overflow-hidden mt-3">
            <div className="h-full bg-primary" style={{ width: `${project.progress}%` }} />
          </div>
          <Badge variant="secondary" className={`${statusColor(project.status)} mt-3`}>
            {statusLabel(project.status)}
          </Badge>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Client</p>
          <p className="font-semibold mt-1">{project.client_name ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{project.client_company ?? ""}</p>
          <p className="text-xs text-muted-foreground mt-2">{project.client_email}</p>
          <p className="text-xs text-muted-foreground">{project.client_phone}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Timeline</p>
          <div className="space-y-1 mt-2 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" /> Start:{" "}
              {fmtDate(project.start_date)}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" /> Due:{" "}
              {fmtDate(project.expected_delivery_date)}
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-3 w-3 text-muted-foreground" /> Delivered:{" "}
              {fmtDate(project.actual_delivery_date)}
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Tech Stack</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(project.technology_stack ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              (project.technology_stack ?? []).map((t: string) => (
                <Badge key={t} variant="secondary" className="bg-accent text-accent-foreground">
                  {t}
                </Badge>
              ))
            )}
          </div>
        </Card>
      </div>

      {(phasesError || membersError) && (
        <p className="text-destructive">
          Some project details could not be loaded. Refresh to try again.
        </p>
      )}
      <Tabs defaultValue="phases">
        <TabsList>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tasks">Ongoing Tasks</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="phases" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold">Project Phases</h3>
              {canEditProject && (
                <div className="flex gap-2 flex-wrap">
                  {canManage && safePhases.length === 0 && (
                    <Button
                      variant="outline"
                      disabled={seedPhases.isPending}
                      title={defaultPhasesFor(projectType).join(" → ")}
                      onClick={() => seedPhases.mutate()}
                    >
                      Add {PROJECT_TYPE_LABEL[projectType]} Phases
                    </Button>
                  )}
                  <AddPhaseDialog
                    projectId={id}
                    members={eligibleMembers}
                    onAdded={() => {
                      qc.invalidateQueries({ queryKey: ["phases", id] });
                      recomputeProgress();
                    }}
                  />
                </div>
              )}
            </div>
            {safePhases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phases yet.</p>
            ) : (
              <div className="space-y-2">
                {orderedPhases.map((ph) => {
                  const owner = safeMembers.find((m) => m.id === ph.assigned_to);
                  const subs = ph.sub_phases ?? [];
                  return (
                    <div
                      key={ph.id}
                      className="p-3 rounded-lg border border-border hover:bg-accent/40"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox
                            className="mt-1 shrink-0"
                            checked={ph.completed}
                            disabled={!canManage || togglePhase.isPending}
                            onCheckedChange={(v) =>
                              togglePhase.mutate({ phaseId: ph.id, completed: !!v })
                            }
                          />
                          <div className="flex-1 min-w-0">
                            <Link
                              to="/projects/$id/phases/$phaseId"
                              params={{ id, phaseId: ph.id }}
                              className={`font-medium break-words hover:underline ${ph.completed ? "line-through text-muted-foreground" : ""}`}
                              title="Open phase"
                            >
                              {ph.name}
                              {subs.length > 0 && (
                                <span className="ml-2 text-xs font-normal text-muted-foreground">
                                  {subs.filter((x) => x.completed).length}/{subs.length} sub-phases
                                </span>
                              )}
                            </Link>
                            <p className="text-xs text-muted-foreground break-words">
                              {owner?.full_name ?? "Unassigned"} · {fmtDate(ph.start_date)} →{" "}
                              {fmtDate(ph.end_date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                          <Badge variant="secondary" className={statusColor(ph.status)}>
                            {statusLabel(ph.status)}
                          </Badge>
                          <Link
                            to="/projects/$id/phases/$phaseId"
                            params={{ id, phaseId: ph.id }}
                            title="Open phase"
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                          {canManage && (
                            <>
                              <EditPhaseDialog
                                phase={ph}
                                members={eligibleMembers}
                                onSaved={() => {
                                  qc.invalidateQueries({ queryKey: ["phases", id] });
                                  recomputeProgress();
                                }}
                              />
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deletePhase.mutate(ph.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card className="p-4 sm:p-6">
            <ProjectTimeline
              project={project}
              phases={safePhases}
              members={safeMembers}
              canEdit={!!canManage}
              onOpenPhase={(phaseId) =>
                navigate({ to: "/projects/$id/phases/$phaseId", params: { id, phaseId } })
              }
              onChanged={() => {
                qc.invalidateQueries({ queryKey: ["phases", id] });
                qc.invalidateQueries({ queryKey: ["project", id] });
                qc.invalidateQueries({ queryKey: ["projects"] });
              }}
            />
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {/* Not-started and in-progress tasks people have logged against this project. */}
          {tasksLoading ? (
            <Card className="p-6">
              <ListRowsSkeleton rows={3} />
            </Card>
          ) : ongoingTasks.length === 0 ? (
            <Card className="p-12 text-center">
              <ListTodo className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
              <h3 className="font-semibold">No ongoing tasks</h3>
              <p className="text-sm text-muted-foreground">
                Tasks that are not started or in progress for this project show here.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <TaskTable
                tasks={ongoingTasks}
                showProject={false}
                ownerName={(t) =>
                  safeMembers.find((m) => m.id === t.assigned_to)?.full_name ?? "Former member"
                }
              />
            </Card>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card className="p-6">
            <div className="grid sm:grid-cols-2 gap-4">
              <RoleSlot
                label="Single-Threaded Owner"
                icon={<Crown className="h-4 w-4 text-amber-500" />}
                member={sto}
                canEdit={canManage}
                value={project.lead_id}
                members={eligibleMembers}
                emptyText={`No ${PROJECT_TYPE_LABEL[projectType]} members yet`}
                onChange={async (uid: string) => {
                  await saveProjectChange({ lead_id: uid || null }, "STO updated");
                }}
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" /> Currently Working On
              </h3>
              {canManage && (
                <AssignMembersDialog
                  projectId={id}
                  department={PROJECT_TYPE_LABEL[projectType]}
                  members={eligibleMembers}
                  current={memberIds}
                  onSaved={() => qc.invalidateQueries({ queryKey: ["project-members", id] })}
                />
              )}
            </div>
            {workingMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No team members assigned yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {workingMembers.map((m) => {
                  const isSto = m.id === project.lead_id;
                  return (
                    <div
                      key={m.id}
                      className="p-3 rounded-lg border border-border flex items-center gap-3"
                    >
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                          {initialsOf(m.full_name ?? m.email ?? "U")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate flex items-center gap-1.5">
                          {m.full_name ?? m.email}
                          {isSto && <Crown className="h-3.5 w-3.5 text-amber-500" />}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {m.designation ?? ""}
                        </p>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Remove"
                          onClick={async () => {
                            try {
                              await removeProjectMember({ data: { projectId: id, userId: m.id } });
                              qc.invalidateQueries({ queryKey: ["project-members", id] });
                            } catch (error) {
                              toast.error(
                                error instanceof Error ? error.message : "Unable to remove member.",
                              );
                            }
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RoleSlot({
  label,
  icon,
  member,
  canEdit,
  value,
  members,
  emptyText,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  member: TeamMember | undefined;
  canEdit: boolean;
  value: string | null;
  members: TeamMember[];
  emptyText: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="p-4 rounded-lg border border-border">
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">
        {icon} {label}
      </p>
      {member ? (
        <div className="flex items-center gap-3 mt-3">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
              {initialsOf(member.full_name ?? member.email ?? "U")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{member.full_name ?? member.email}</p>
            <p className="text-xs text-muted-foreground truncate">{member.designation ?? ""}</p>
          </div>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground mt-3">Unassigned</p>
      )}
      {canEdit && (
        <div className="mt-3">
          <Select
            value={value ?? "__none__"}
            onValueChange={(v) => onChange(v === "__none__" ? "" : v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Assign…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Unassigned —</SelectItem>
              {members.length === 0 && (
                <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
              )}
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.full_name ?? m.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function AssignMembersDialog({
  projectId,
  department,
  members,
  current,
  onSaved,
}: {
  projectId: string;
  department: string;
  members: TeamMember[];
  current: string[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<string>("");
  const add = async () => {
    if (!pick) return;
    try {
      await addProjectMember({ data: { projectId, userId: pick } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to assign member.");
      return;
    }
    toast.success("Member assigned");
    onSaved();
    setPick("");
    setOpen(false);
  };
  const available = members.filter((m) => !current.includes(m.id));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="h-4 w-4 mr-2" />
          Assign Member
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a team member</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label>{department} team member</Label>
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger>
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {members.length === 0
                    ? `No members in the ${department} department.`
                    : "Everyone is already assigned."}
                </div>
              ) : (
                available.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button disabled={!pick} onClick={add}>
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({ project, onSaved }: { project: ProjectDoc; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: project.name ?? "",
    description: project.description ?? "",
    client_name: project.client_name ?? "",
    client_company: project.client_company ?? "",
    client_email: project.client_email ?? "",
    client_phone: project.client_phone ?? "",
    start_date: project.start_date ?? "",
    expected_delivery_date: project.expected_delivery_date ?? "",
    actual_delivery_date: project.actual_delivery_date ?? "",
    priority: project.priority ?? "medium",
    technology_stack: (project.technology_stack ?? []).join(", "),
  });
  const update = (k: string, v: string) => setForm((s) => ({ ...s, [k]: v }));
  const m = useMutation({
    mutationFn: async () => {
      await updateProject({
        data: {
          id: project.id,
          changes: {
            name: form.name,
            description: form.description || null,
            client_name: form.client_name || null,
            client_company: form.client_company || null,
            client_email: form.client_email || null,
            client_phone: form.client_phone || null,
            start_date: form.start_date || null,
            expected_delivery_date: form.expected_delivery_date || null,
            actual_delivery_date: form.actual_delivery_date || null,
            priority: form.priority as Priority,
            technology_stack: form.technology_stack
              ? form.technology_stack
                  .split(",")
                  .map((s: string) => s.trim())
                  .filter(Boolean)
              : null,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Project updated");
      onSaved();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit Project
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Project</DialogTitle>
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
            <Input
              value={form.client_name}
              onChange={(e) => update("client_name", e.target.value)}
            />
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
            <Label>Actual Delivery</Label>
            <DatePicker
              value={form.actual_delivery_date}
              onChange={(v) => update("actual_delivery_date", v)}
            />
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
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPhaseDialog({
  projectId,
  members,
  onAdded,
}: {
  projectId: string;
  members: TeamMember[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    assigned_to: "",
    start_date: "",
    end_date: "",
    status: "not_started",
    notes: "",
  });
  const m = useMutation({
    mutationFn: async () => {
      await createProjectPhase({
        data: {
          projectId,
          phase: {
            name: form.name,
            assigned_to: form.assigned_to || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            status: form.status as PhaseStatus,
            notes: form.notes || null,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Phase added");
      onAdded();
      setOpen(false);
      setForm({
        name: "",
        assigned_to: "",
        start_date: "",
        end_date: "",
        status: "not_started",
        notes: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-2" />
          Add Phase
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Phase</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Phase name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select
              value={form.assigned_to}
              onValueChange={(v) => setForm({ ...form, assigned_to: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <DatePicker
                value={form.start_date}
                onChange={(v) => setForm({ ...form, start_date: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <DatePicker
                value={form.end_date}
                onChange={(v) => setForm({ ...form, end_date: v })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PHASE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPhaseDialog({
  phase,
  members,
  onSaved,
}: {
  phase: PhaseDoc;
  members: TeamMember[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: phase.name ?? "",
    assigned_to: phase.assigned_to ?? "",
    start_date: phase.start_date ?? "",
    end_date: phase.end_date ?? "",
    status: phase.status ?? "not_started",
    notes: phase.notes ?? "",
  });
  const m = useMutation({
    mutationFn: async () => {
      await updateProjectPhase({
        data: {
          projectId: phase.project_id,
          phaseId: phase.id,
          changes: {
            name: form.name,
            assigned_to: form.assigned_to || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            status: form.status as PhaseStatus,
            notes: form.notes || null,
          },
        },
      });
    },
    onSuccess: () => {
      toast.success("Phase updated");
      onSaved();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit phase">
          <Pencil className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Phase</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Phase name *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select
              value={form.assigned_to}
              onValueChange={(v) => setForm({ ...form, assigned_to: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose member" />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start</Label>
              <DatePicker
                value={form.start_date}
                onChange={(v) => setForm({ ...form, start_date: v })}
              />
            </div>
            <div className="space-y-2">
              <Label>End</Label>
              <DatePicker
                value={form.end_date}
                onChange={(v) => setForm({ ...form, end_date: v })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["not_started", "in_progress", "completed", "blocked"].map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
