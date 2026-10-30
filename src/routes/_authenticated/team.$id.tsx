import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMember, updateMemberProfile } from "@/lib/app.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DEPARTMENTS, type Department } from "@/lib/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, Briefcase, Calendar, Crown, Pencil, Wrench } from "lucide-react";
import { statusLabel, statusColor, priorityColor, availabilityLabel, fmtDate } from "@/lib/format";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AvailabilityIcon } from "@/components/availability-status";
import { MemberDetailSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/team/$id")({
  head: () => ({ meta: [{ title: "Member — Marko Projects" }] }),
  component: MemberDetail,
});

function MemberDetail() {
  const { id } = Route.useParams();
  const { data: me } = useCurrentUser();
  const isStaff = me?.role === "Super_Admin" || me?.role === "Admin" || me?.role === "SEO";

  const { data: detail, isLoading } = useQuery({
    queryKey: ["team-member", id],
    queryFn: () => getMember({ data: { id } }),
  });
  const member = detail?.member ?? null;
  const tasks = detail?.tasks ?? [];
  const projects = detail?.projects ?? [];
  const memberships: string[] = detail?.memberships ?? [];

  if (isLoading) return <MemberDetailSkeleton />;
  if (!member) return <div className="p-8 text-muted-foreground">Member not found.</div>;

  const today = new Date().toISOString().slice(0, 10);
  const todaysTasks = tasks.filter(
    (t) => (t.created_at ?? "").slice(0, 10) === today || t.due_date === today,
  );
  const previousTasks = tasks.filter((t) => !todaysTasks.includes(t));

  const working = projects.filter(
    (p) => memberships.includes(p.id) || p.lead_id === id || p.maintainer_id === id,
  );
  const maintains = projects.filter((p) => p.maintainer_id === id);
  const ownsAsSto = projects.filter((p) => p.lead_id === id);

  const display = member.full_name ?? "Team member";
  const initials = display
    .split(" ")
    .map((s: string) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <Link
        to="/team"
        className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
      >
        <ArrowLeft className="h-4 w-4" /> Back to team
      </Link>

      <Card className="p-4 sm:p-6">
        <div className="flex items-center gap-4 flex-wrap">
          <Avatar className="h-14 w-14 sm:h-16 sm:w-16 shrink-0">
            <AvatarFallback className="bg-primary text-primary-foreground text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-[10rem]">
            <h1 className="text-xl sm:text-2xl font-bold break-words">{display}</h1>
            <p className="text-sm text-muted-foreground">{member.designation ?? "—"}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
              {member.department && (
                <span className="inline-flex items-center gap-1">
                  <Briefcase className="h-3 w-3" /> {member.department}
                </span>
              )}
              {member.joining_date && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> joined {fmtDate(member.joining_date)}
                </span>
              )}
              <Badge variant="secondary" className="gap-1.5">
                <AvailabilityIcon value={member.availability} className="h-3.5 w-3.5" />
                {availabilityLabel(member.availability)}
              </Badge>
            </div>
            {!isStaff && (
              <p className="text-xs text-muted-foreground mt-2 italic">
                Contact details visible to admins only.
              </p>
            )}
          </div>
          {detail?.canEdit && (
            <div className="self-start ml-auto">
              <EditMemberDialog member={member} />
            </div>
          )}
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="p-4 sm:p-6 border-primary/40 bg-primary/[0.04]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold">Today's Tasks · {fmtDate(today)}</h2>
            <Badge variant="secondary">{todaysTasks.length}</Badge>
          </div>
          {todaysTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tasks for today.</p>
          ) : (
            <div className="space-y-2">
              {todaysTasks.map((t) => (
                <TaskLine key={t.id} t={t} />
              ))}
            </div>
          )}
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold">Previous Tasks</h2>
            <Badge variant="secondary">{previousTasks.length}</Badge>
          </div>
          {previousTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No prior tasks.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-auto overscroll-contain pr-1">
              {previousTasks.map((t) => (
                <TaskLine key={t.id} t={t} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <ProjectList
          title="Currently working on"
          icon={<Briefcase className="h-4 w-4" />}
          projects={working}
          stoIds={ownsAsSto.map((p) => p.id)}
        />
        <ProjectList
          title="Maintains"
          icon={<Wrench className="h-4 w-4" />}
          projects={maintains}
          stoIds={ownsAsSto.map((p) => p.id)}
        />
        <ProjectList
          title="Single-threaded owner"
          icon={<Crown className="h-4 w-4 text-amber-500" />}
          projects={ownsAsSto}
          stoIds={ownsAsSto.map((p) => p.id)}
        />
      </div>
    </div>
  );
}

type Member = NonNullable<Awaited<ReturnType<typeof getMember>>>["member"];

function EditMemberDialog({ member }: { member: Member }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const initial = () => ({
    full_name: member.full_name ?? "",
    designation: member.designation ?? "",
    // Older free-text departments that aren't in the list start out unselected.
    department: (DEPARTMENTS as readonly string[]).includes(member.department ?? "")
      ? (member.department as Department)
      : ("" as Department | ""),
    phone: member.phone ?? "",
  });
  const [form, setForm] = useState(initial);
  const update = (k: keyof typeof form, v: string) => setForm((s) => ({ ...s, [k]: v }));

  const save = useMutation({
    mutationFn: () =>
      updateMemberProfile({
        data: {
          id: member.id,
          changes: {
            full_name: form.full_name.trim(),
            designation: form.designation.trim() || null,
            department: form.department || null,
            phone: form.phone.trim() || null,
          },
        },
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      qc.invalidateQueries({ queryKey: ["team-member", member.id] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["members"] });
      qc.invalidateQueries({ queryKey: ["current-user"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        // Refill from the latest saved values each time the form opens.
        if (o) setForm(initial());
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="h-4 w-4 mr-2" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Member</DialogTitle>
        </DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Full name</Label>
            <Input value={form.full_name} onChange={(e) => update("full_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Designation</Label>
            <Input
              value={form.designation}
              onChange={(e) => update("designation", e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Department</Label>
            <Select
              value={form.department}
              onValueChange={(v) => setForm((s) => ({ ...s, department: v as Department }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                {DEPARTMENTS.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button disabled={!form.full_name.trim() || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskLine({
  t,
}: {
  t: NonNullable<Awaited<ReturnType<typeof getMember>>>["tasks"][number];
}) {
  return (
    <div className="p-3 rounded-lg border border-border flex flex-wrap items-center gap-2 sm:gap-3">
      <div className="flex-1 min-w-[10rem]">
        <p className="font-medium text-sm break-words">{t.name}</p>
        <p className="text-xs text-muted-foreground">
          {t.projects?.name ?? "—"}
          {t.due_date && ` · due ${fmtDate(t.due_date)}`}
        </p>
      </div>
      <Badge variant="secondary" className={priorityColor(t.priority)}>
        {t.priority}
      </Badge>
      <Badge variant="secondary" className={statusColor(t.status)}>
        {statusLabel(t.status)}
      </Badge>
    </div>
  );
}

function ProjectList({
  title,
  icon,
  projects,
  stoIds,
}: {
  title: string;
  icon: React.ReactNode;
  projects: NonNullable<Awaited<ReturnType<typeof getMember>>>["projects"];
  stoIds: string[];
}) {
  return (
    <Card className="p-4 sm:p-5">
      <h3 className="font-semibold flex items-center gap-2 mb-3">
        {icon} {title}
      </h3>
      {projects.length === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => {
            const isSto = stoIds.includes(p.id);
            return (
              <Link
                key={p.id}
                to="/projects/$id"
                params={{ id: p.id }}
                className="block p-2 rounded-md hover:bg-accent/40 transition-colors"
              >
                <p className="font-medium text-sm truncate flex items-center gap-1.5">
                  {p.name}
                  {isSto && (
                    <Crown
                      className="h-3.5 w-3.5 text-amber-500 shrink-0"
                      aria-label="Single-threaded owner"
                    />
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {statusLabel(p.status)} · {p.progress}%
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </Card>
  );
}
