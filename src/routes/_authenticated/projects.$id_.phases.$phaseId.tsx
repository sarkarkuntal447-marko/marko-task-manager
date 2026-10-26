import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar } from "lucide-react";
import { toast } from "sonner";
import { getProject, listProjectPhases, updateProjectPhase } from "@/lib/projects.functions";
import { getTeamDirectory } from "@/lib/app.functions";
import { SubPhases } from "@/components/sub-phases";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { statusLabel, statusColor, fmtDate } from "@/lib/format";
import { useCurrentUser, canManageProjects } from "@/hooks/use-current-user";
import { PhaseDetailSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/projects/$id_/phases/$phaseId")({
  head: () => ({ meta: [{ title: "Phase — Marko Projects" }] }),
  component: PhasePage,
});

function PhasePage() {
  const { id, phaseId } = Route.useParams();
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const canManage = canManageProjects(me?.role);

  const { data: project } = useQuery({
    queryKey: ["project", id],
    queryFn: () => getProject({ data: { id } }),
  });
  const {
    data: phases = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["phases", id],
    queryFn: () => listProjectPhases({ data: { projectId: id } }),
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => getTeamDirectory(),
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["phases", id] });
    qc.invalidateQueries({ queryKey: ["project", id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
  };

  // Ticking the parent ticks every sub-phase (the server does the cascade).
  const toggleParent = useMutation({
    mutationFn: (completed: boolean) =>
      updateProjectPhase({
        data: {
          projectId: id,
          phaseId,
          changes: { status: completed ? "completed" : "in_progress" },
        },
      }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  const phase = phases.find((p) => p.id === phaseId);
  const back = (
    <Link
      to="/projects/$id"
      params={{ id }}
      className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground max-w-full"
    >
      <ArrowLeft className="h-4 w-4 mr-1 shrink-0" />{" "}
      <span className="truncate">Back to {project?.name ?? "project"}</span>
    </Link>
  );

  if (isLoading) return <PhaseDetailSkeleton />;
  if (error)
    return (
      <div className="p-8 text-destructive">
        {error instanceof Error ? error.message : "Unable to load phase."}
      </div>
    );
  if (!phase)
    return (
      <div className="p-8 space-y-3">
        {back}
        <p>Phase not found.</p>
      </div>
    );

  const subs = phase.sub_phases ?? [];
  const done = subs.filter((s) => s.completed).length;
  const pct = subs.length ? Math.round((done / subs.length) * 100) : phase.completed ? 100 : 0;
  const owner = members.find((m) => m.id === phase.assigned_to);

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {back}

      <Card className="p-4 sm:p-6 space-y-4">
        <div className="flex items-start gap-3">
          <Checkbox
            className="mt-1.5"
            checked={!!phase.completed}
            disabled={!canManage || toggleParent.isPending}
            onCheckedChange={(v) => toggleParent.mutate(!!v)}
          />
          <div className="flex-1 min-w-0">
            <h1
              className={`text-xl sm:text-2xl font-bold break-words ${phase.completed ? "line-through text-muted-foreground" : ""}`}
            >
              {phase.name}
            </h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap mt-1">
              <Calendar className="h-3.5 w-3.5" /> {fmtDate(phase.start_date)} →{" "}
              {fmtDate(phase.end_date)}
              <span>· {owner?.full_name ?? "Unassigned"}</span>
            </p>
          </div>
          <Badge variant="secondary" className={`${statusColor(phase.status)} shrink-0`}>
            {statusLabel(phase.status)}
          </Badge>
        </div>
        {phase.notes && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{phase.notes}</p>
        )}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {subs.length ? `${done} of ${subs.length} sub-phases done` : "No sub-phases yet"}
            </span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} />
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <h2 className="font-semibold mb-1">Sub-phases</h2>
        <p className="text-xs text-muted-foreground mb-4">
          When every sub-phase is ticked the phase is marked done automatically, and ticking the
          phase ticks all of them.
        </p>
        <SubPhases bare projectId={id} phase={phase} canManage={!!canManage} onChanged={refresh} />
      </Card>
    </div>
  );
}
