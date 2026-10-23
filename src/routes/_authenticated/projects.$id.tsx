import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { getTeamDirectory } from "@/lib/app.functions";
import {
  type ProjectInput, getProject, updateProject, archiveProject, listProjectPhases, createProjectPhase,
  updateProjectPhase, deleteProjectPhase, seedProjectPhases, listProjectTasks,
  createProjectTask, listProjectMembers, addProjectMember, removeProjectMember,
} from "@/lib/projects.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronRight, ArrowLeft, Plus, Trash2, Calendar, Users, Pencil, Crown, Wrench, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { ProjectTimeline } from "@/components/project-timeline";
import { ProjectDetailSkeleton, ListRowsSkeleton } from "@/components/skeletons";
import { statusLabel, statusColor, priorityColor, fmtDate } from "@/lib/format";
import { useCurrentUser, canManageProjects, canAssignTasks } from "@/hooks/use-current-user";

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [{ title: "Project — Marko Projects" }] }),
  component: ProjectDetail,
});

const DEFAULT_PHASES = [
  "Requirement Gathering", "UI/UX Design", "Frontend Development", "Backend Development",
  "API Integration", "CRM Integration", "Database Setup", "Testing & QA", "Deployment",
  "Client Review", "Maintenance",
];
const TASK_STATUSES = ["pending", "in_progress", "blocked", "testing", "completed"];
const PRIORITIES = ["low", "medium", "high", "critical"];
const PHASE_STATUSES = ["not_started", "in_progress", "completed", "blocked"];
const PROJECT_STATUSES = ["planning", "requirement_gathering", "design", "development", "api_integration", "crm_integration", "testing", "deployment", "client_review", "live", "in_progress", "maintenance", "completed", "on_hold", "cancelled"];

const initialsOf = (name: string) => name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

function ProjectDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useCurrentUser();
  const canManage = canManageProjects(me?.role);
  const canAssign = canAssignTasks(me?.role);

  const { data: project, isLoading: projectLoading, error: projectError } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });

  const { data: phases = [], error: phasesError } = useQuery({
    queryKey: ["phases", id],
    queryFn: () => listProjectPhases({ data: { projectId: id } }),
  });

  const { data: tasks = [], error: tasksError } = useQuery({
    queryKey: ["tasks", id],
    queryFn: () => listProjectTasks({ data: { projectId: id } }),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => getTeamDirectory(),
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

    onSuccess: () => { toast.success("Default phases added"); qc.invalidateQueries({ queryKey: ["phases", id] }); recomputeProgress(); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePhase = useMutation({
    mutationFn: ({ phaseId, completed }: { phaseId: string; completed: boolean }) =>
      updateProjectPhase({ data: { projectId: id, phaseId, changes: { status: completed ? "completed" : "in_progress" } } }),

    onSuccess: async () => {
      qc.invalidateQueries({ queryKey: ["phases", id] });
      await recomputeProgress();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deletePhase = useMutation({
    mutationFn: (phaseId: string) => deleteProjectPhase({ data: { projectId: id, phaseId } }),

    onSuccess: async () => { qc.invalidateQueries({ queryKey: ["phases", id] }); await recomputeProgress(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: (status: string) => updateProject({ data: { id, changes: { status: status as ProjectInput["status"] } } }),

    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", id] }); qc.invalidateQueries({ queryKey: ["projects"] }); toast.success("Status updated"); },
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

  const archive = useMutation({
    mutationFn: () => archiveProject({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.removeQueries({ queryKey: ["project", id] });
      toast.success("Project archived");
      navigate({ to: "/projects" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (projectLoading) return <ProjectDetailSkeleton />;
  if (projectError) return <div className="p-8 text-destructive">{projectError instanceof Error ? projectError.message : "Unable to load project."}</div>;
  if (!project) return <div className="p-8">Project not found.</div>;

  const safeMembers = Array.isArray(members) ? members : [];
  const safeProjectMembers = Array.isArray(projectMembers) ? projectMembers : [];
  const safePhases = Array.isArray(phases) ? phases : [];
  const safeTasks = Array.isArray(tasks) ? tasks : [];
  const memberIds = safeProjectMembers.map((m: any) => m.user_id).filter(Boolean);
  const workingMembers = safeMembers.filter((m: any) => memberIds.includes(m.id));
  const sto = safeMembers.find((m: any) => m.id === project.lead_id);
  const maintainer = safeMembers.find((m: any) => m.id === project.maintainer_id);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link to="/projects" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-bold break-words min-w-0">{project.name}</h1>
            <Badge variant="secondary" className={priorityColor(project.priority)}>{project.priority}</Badge>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl break-words">{project.description}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {canManage && (
            <>
              <EditProjectDialog project={project} onSaved={() => { qc.invalidateQueries({ queryKey: ["project", id] }); qc.invalidateQueries({ queryKey: ["projects"] }); }} />
              <Button variant="outline" disabled={archive.isPending} onClick={() => {
                if (window.confirm("Archive this project? It will be hidden from the project list. Its records will be kept.")) archive.mutate();
              }}>Archive Project</Button>
              <Select value={project.status} onValueChange={(v) => updateStatus.mutate(v)}>
                <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>
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
          <Badge variant="secondary" className={`${statusColor(project.status)} mt-3`}>{statusLabel(project.status)}</Badge>
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
            <div className="flex items-center gap-2"><Calendar className="h-3 w-3 text-muted-foreground" /> Start: {fmtDate(project.start_date)}</div>
            <div className="flex items-center gap-2"><Calendar className="h-3 w-3 text-muted-foreground" /> Due: {fmtDate(project.expected_delivery_date)}</div>
            <div className="flex items-center gap-2"><Calendar className="h-3 w-3 text-muted-foreground" /> Delivered: {fmtDate(project.actual_delivery_date)}</div>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Tech Stack</p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(project.technology_stack ?? []).length === 0
              ? <p className="text-sm text-muted-foreground">—</p>
              : (project.technology_stack ?? []).map((t: string) => (
                <Badge key={t} variant="secondary" className="bg-accent text-accent-foreground">{t}</Badge>
              ))
            }
          </div>
        </Card>
      </div>

      {(phasesError || tasksError || membersError) && <p className="text-destructive">Some project details could not be loaded. Refresh to try again.</p>}
      <Tabs defaultValue="phases">
        <TabsList>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="phases" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold">Project Phases</h3>
              {canManage && (
                <div className="flex gap-2 flex-wrap">
                  {safePhases.length === 0 && (
                    <Button variant="outline" onClick={() => seedPhases.mutate()}>Seed Default Phases</Button>
                  )}
                  <AddPhaseDialog projectId={id} members={safeMembers} onAdded={() => { qc.invalidateQueries({ queryKey: ["phases", id] }); recomputeProgress(); }} />
                </div>
              )}
            </div>
            {safePhases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phases yet.</p>
            ) : (
              <div className="space-y-2">
                {safePhases.map((ph) => {
                  const owner = safeMembers.find((m) => m.id === ph.assigned_to);
                  const subs: any[] = ph.sub_phases ?? [];
                  return (
                    <div key={ph.id} className="p-3 rounded-lg border border-border hover:bg-accent/40">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <Checkbox className="mt-1 shrink-0" checked={ph.completed} disabled={!canManage || togglePhase.isPending} onCheckedChange={(v) => togglePhase.mutate({ phaseId: ph.id, completed: !!v })} />
                          <div className="flex-1 min-w-0">
                            <Link to="/projects/$id/phases/$phaseId" params={{ id, phaseId: ph.id }}
                              className={`font-medium break-words hover:underline ${ph.completed ? "line-through text-muted-foreground" : ""}`} title="Open phase">{ph.name}
                              {subs.length > 0 && <span className="ml-2 text-xs font-normal text-muted-foreground">{subs.filter((x) => x.completed).length}/{subs.length} sub-phases</span>}
                            </Link>
                            <p className="text-xs text-muted-foreground break-words">
                              {owner?.full_name ?? "Unassigned"} · {fmtDate(ph.start_date)} → {fmtDate(ph.end_date)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap sm:shrink-0">
                          <Badge variant="secondary" className={statusColor(ph.status)}>{statusLabel(ph.status)}</Badge>
                          <Link to="/projects/$id/phases/$phaseId" params={{ id, phaseId: ph.id }} title="Open phase" className="text-muted-foreground hover:text-foreground">
                            <ChevronRight className="h-5 w-5" />
                          </Link>
                          {canManage && (
                            <>
                              <EditPhaseDialog phase={ph} members={safeMembers} onSaved={() => { qc.invalidateQueries({ queryKey: ["phases", id] }); recomputeProgress(); }} />
                              <Button variant="ghost" size="icon" onClick={() => deletePhase.mutate(ph.id)}>
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
              project={project} phases={safePhases} tasks={safeTasks} members={safeMembers} canEdit={!!canManage}
              onOpenPhase={(phaseId) => navigate({ to: "/projects/$id/phases/$phaseId", params: { id, phaseId } })}
              onChanged={() => { qc.invalidateQueries({ queryKey: ["phases", id] }); qc.invalidateQueries({ queryKey: ["project", id] }); qc.invalidateQueries({ queryKey: ["projects"] }); }}
            />
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold">Tasks</h3>
              {canAssign && <NewTaskDialog projectId={id} members={safeMembers} phases={safePhases} onAdded={() => qc.invalidateQueries({ queryKey: ["tasks", id] })} />}
            </div>
            {safeTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks yet.</p>
            ) : (
              <div className="space-y-2">
                {safeTasks.map((t) => {
                  const owner = safeMembers.find((m) => m.id === t.assigned_to);
                  return (
                    <div key={t.id} className="p-3 rounded-lg border border-border flex items-center gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{owner?.full_name ?? "Unassigned"}{safePhases.find((ph: any) => ph.id === t.phase_id) ? ` · ${safePhases.find((ph: any) => ph.id === t.phase_id)?.name ?? ""}` : ""} · Due {fmtDate(t.due_date)}</p>
                      </div>
                      <Badge variant="secondary" className={priorityColor(t.priority)}>{t.priority}</Badge>
                      <Badge variant="secondary" className={statusColor(t.status)}>{statusLabel(t.status)}</Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
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
                members={safeMembers}
                onChange={async (uid: string) => {
                  await saveProjectChange({ lead_id: uid || null }, "STO updated");
                }}
              />
              <RoleSlot
                label="Maintainer"
                icon={<Wrench className="h-4 w-4 text-primary" />}
                member={maintainer}
                canEdit={canManage}
                value={project.maintainer_id}
                members={safeMembers}
                onChange={async (uid: string) => {
                  await saveProjectChange({ maintainer_id: uid || null }, "Maintainer updated");
                }}
              />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4" /> Currently Working On</h3>
              {canManage && (
                <AssignMembersDialog
                  projectId={id}
                  members={safeMembers}
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
                    <div key={m.id} className="p-3 rounded-lg border border-border flex items-center gap-3">
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
                        <p className="text-xs text-muted-foreground truncate">{m.designation ?? ""}</p>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost" size="icon" title="Remove"
                          onClick={async () => {
                            try {
                              await removeProjectMember({ data: { projectId: id, userId: m.id } });
                              qc.invalidateQueries({ queryKey: ["project-members", id] });
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Unable to remove member.");
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

function RoleSlot({ label, icon, member, canEdit, value, members, onChange }: any) {
  return (
    <div className="p-4 rounded-lg border border-border">
      <p className="text-xs uppercase tracking-wide text-muted-foreground flex items-center gap-2">{icon} {label}</p>
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
          <Select value={value ?? "__none__"} onValueChange={(v) => onChange(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Assign…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">— Unassigned —</SelectItem>
              {members.map((m: any) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}

function AssignMembersDialog({ projectId, members, current, onSaved }: {
  projectId: string; members: any[]; current: string[]; onSaved: () => void;
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
        <Button size="sm" variant="outline"><UserPlus className="h-4 w-4 mr-2" />Assign Member</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign a team member</DialogTitle></DialogHeader>
        <div className="space-y-2">
          <Label>Team member</Label>
          <Select value={pick} onValueChange={setPick}>
            <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
            <SelectContent>
              {available.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Everyone is already assigned.</div>
              ) : available.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter><Button disabled={!pick} onClick={add}>Assign</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditProjectDialog({ project, onSaved }: { project: any; onSaved: () => void }) {
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
          id: project.id, changes: {
            name: form.name,
            description: form.description || null,
            client_name: form.client_name || null,
            client_company: form.client_company || null,
            client_email: form.client_email || null,
            client_phone: form.client_phone || null,
            start_date: form.start_date || null,
            expected_delivery_date: form.expected_delivery_date || null,
            actual_delivery_date: form.actual_delivery_date || null,
            priority: form.priority as any,
            technology_stack: form.technology_stack
              ? form.technology_stack.split(",").map((s: string) => s.trim()).filter(Boolean)
              : null,
          }
        }
      });
    },
    onSuccess: () => { toast.success("Project updated"); onSaved(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="h-4 w-4 mr-2" />Edit Project</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Project</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-2">
            <Label>Project Name *</Label>
            <Input value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} />
          </div>
          <div className="space-y-2"><Label>Client Name</Label><Input value={form.client_name} onChange={(e) => update("client_name", e.target.value)} /></div>
          <div className="space-y-2"><Label>Client Company</Label><Input value={form.client_company} onChange={(e) => update("client_company", e.target.value)} /></div>
          <div className="space-y-2"><Label>Client Email</Label><Input type="email" value={form.client_email} onChange={(e) => update("client_email", e.target.value)} /></div>
          <div className="space-y-2"><Label>Client Phone</Label><Input value={form.client_phone} onChange={(e) => update("client_phone", e.target.value)} /></div>
          <div className="space-y-2"><Label>Start Date</Label><DatePicker value={form.start_date} onChange={(v) => update("start_date", v)} /></div>
          <div className="space-y-2"><Label>Expected Delivery</Label><DatePicker value={form.expected_delivery_date} onChange={(v) => update("expected_delivery_date", v)} /></div>
          <div className="space-y-2"><Label>Actual Delivery</Label><DatePicker value={form.actual_delivery_date} onChange={(v) => update("actual_delivery_date", v)} /></div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <Select value={form.priority} onValueChange={(v) => update("priority", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{statusLabel(p)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Tech Stack (comma separated)</Label>
            <Input value={form.technology_stack} onChange={(e) => update("technology_stack", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPhaseDialog({ projectId, members, onAdded }: { projectId: string; members: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", assigned_to: "", start_date: "", end_date: "", status: "not_started", notes: "" });
  const m = useMutation({
    mutationFn: async () => {
      await createProjectPhase({
        data: {
          projectId, phase: {
            name: form.name,
            assigned_to: form.assigned_to || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            status: form.status as any,
            notes: form.notes || null,
          }
        }
      });
    },
    onSuccess: () => { toast.success("Phase added"); onAdded(); setOpen(false); setForm({ name: "", assigned_to: "", start_date: "", end_date: "", status: "not_started", notes: "" }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Add Phase</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Phase</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Phase name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder="Choose member" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Start</Label><DatePicker value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} /></div>
            <div className="space-y-2"><Label>End</Label><DatePicker value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PHASE_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>Add</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewTaskDialog({ projectId, members, phases, onAdded }: { projectId: string; members: any[]; phases: any[]; onAdded: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", assigned_to: "", phase_id: "", due_date: "", priority: "medium", status: "pending" });
  const m = useMutation({
    mutationFn: async () => {
      await createProjectTask({
        data: {
          projectId, task: {
            name: form.name,
            description: form.description || null,
            assigned_to: form.assigned_to || null,
            phase_id: form.phase_id || null,
            due_date: form.due_date || null,
            priority: form.priority as any,
            status: form.status as any,
          }
        }
      });
    },
    onSuccess: () => { toast.success("Task created"); onAdded(); setOpen(false); setForm((f) => ({ ...f, name: "", description: "", phase_id: "" })); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />New Task</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New Task</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Task name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Assign to</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
                <SelectTrigger><SelectValue placeholder="Member" /></SelectTrigger>
                <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Phase</Label>
              <Select value={form.phase_id} onValueChange={(v) => setForm({ ...form, phase_id: v })}>
                <SelectTrigger><SelectValue placeholder={safePhases.length ? "Select a phase (optional)" : "No phases yet — add them in the Phases tab"} /></SelectTrigger>
                <SelectContent>{safePhases.map((ph: any) => <SelectItem key={ph.id} value={ph.id}>{ph.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Due Date</Label><DatePicker value={form.due_date} onChange={(v) => setForm({ ...form, due_date: v })} /></div>
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{statusLabel(p)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
        <DialogFooter><Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditPhaseDialog({ phase, members, onSaved }: { phase: any; members: any[]; onSaved: () => void }) {
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
          projectId: phase.project_id, phaseId: phase.id, changes: {
            name: form.name,
            assigned_to: form.assigned_to || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
            status: form.status as any,
            notes: form.notes || null,
          }
        }
      });
    },
    onSuccess: () => { toast.success("Phase updated"); onSaved(); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Edit phase"><Pencil className="h-4 w-4" /></Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit Phase</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2"><Label>Phase name *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-2">
            <Label>Assign to</Label>
            <Select value={form.assigned_to} onValueChange={(v) => setForm({ ...form, assigned_to: v })}>
              <SelectTrigger><SelectValue placeholder="Choose member" /></SelectTrigger>
              <SelectContent>{members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name ?? m.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label>Start</Label><DatePicker value={form.start_date} onChange={(v) => setForm({ ...form, start_date: v })} /></div>
            <div className="space-y-2"><Label>End</Label><DatePicker value={form.end_date} onChange={(v) => setForm({ ...form, end_date: v })} /></div>
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["not_started", "in_progress", "completed", "blocked"].map((s) => <SelectItem key={s} value={s}>{statusLabel(s)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button disabled={!form.name || m.isPending} onClick={() => m.mutate()}>Save</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}