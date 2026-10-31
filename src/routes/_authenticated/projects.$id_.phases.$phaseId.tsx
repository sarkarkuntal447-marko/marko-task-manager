import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar } from "lucide-react";
import { getProject, listProjectPhases } from "@/lib/projects.functions";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { statusLabel, statusColor, fmtDate } from "@/lib/format";
import { PhaseDetailSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/projects/$id_/phases/$phaseId")({
  head: () => ({ meta: [{ title: "Phase — Marko Projects" }] }),
  component: PhasePage,
});

/** Read-only details of one phase; phases are edited from the project's Phases tab. */
function PhasePage() {
  const { id, phaseId } = Route.useParams();

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

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {back}

      <Card className="p-4 sm:p-6 space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {project?.name ?? "Project"} · Phase
            </p>
            <h1 className="text-xl sm:text-2xl font-bold break-words mt-1">{phase.name}</h1>
          </div>
          <Badge variant="secondary" className={`${statusColor(phase.status)} shrink-0`}>
            {statusLabel(phase.status)}
          </Badge>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Start Date</p>
            <p className="mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> {fmtDate(phase.start_date)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">End Date</p>
            <p className="mt-1 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" /> {fmtDate(phase.end_date)}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm whitespace-pre-wrap break-words">
            {phase.notes || <span className="text-muted-foreground">No notes.</span>}
          </p>
        </div>
      </Card>
    </div>
  );
}
