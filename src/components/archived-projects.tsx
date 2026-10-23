import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listArchivedProjects, restoreProject } from "@/lib/projects.functions";
import { useCurrentUser, canManageProjects } from "@/hooks/use-current-user";
import { fmtDate, statusLabel } from "@/lib/format";

/** Admin-only card listing archived projects, each with a Restore button. */
export function ArchivedProjects() {
    const qc = useQueryClient();
    const { data: me } = useCurrentUser();
    const canManage = canManageProjects(me?.role);

    const { data: archived = [], isLoading } = useQuery({
        queryKey: ["projects-archived"],
        queryFn: () => listArchivedProjects(),
        enabled: canManage,
    });

    const restore = useMutation({
        mutationFn: (id: string) => restoreProject({ data: { id } }),
        onSuccess: () => {
            toast.success("Project restored");
            qc.invalidateQueries({ queryKey: ["projects-archived"] });
            qc.invalidateQueries({ queryKey: ["projects"] });
            qc.invalidateQueries({ queryKey: ["projects-min"] });
            qc.invalidateQueries({ queryKey: ["dashboard"] });
        },
        onError: (e: Error) => toast.error(e.message),
    });

    if (!canManage) return null;
    if (!isLoading && archived.length === 0) return null;

    return (
        <Card className="p-6">
            <h2 className="font-semibold mb-4">Archived Projects</h2>
            {isLoading ? (
                <div className="space-y-2">
                    <Skeleton className="h-14 w-full" />
                    <Skeleton className="h-14 w-full" />
                </div>
            ) : (
                <div className="space-y-2">
                    {archived.map((p: any) => (
                        <div key={p.id} className="p-3 rounded-lg border border-border flex items-center gap-3 flex-wrap">
                            <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{p.name}</p>
                                <p className="text-xs text-muted-foreground">Archived {fmtDate(p.archived_at)}</p>
                            </div>
                            <Badge variant="secondary">{statusLabel(p.status)}</Badge>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={restore.isPending}
                                onClick={() => restore.mutate(p.id)}
                            >
                                <ArchiveRestore className="h-4 w-4 mr-2" /> Restore
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </Card>
    );
}