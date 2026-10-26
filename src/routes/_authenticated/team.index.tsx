import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { deleteUser, getTeamWithWorkload } from "@/lib/app.functions";
import { TeamCardSkeleton } from "@/components/skeletons";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Briefcase, ChevronRight, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/team/")({
  head: () => ({ meta: [{ title: "Team — Marko Projects" }] }),
  component: TeamPage,
});

const availabilityColor: Record<string, string> = {
  available: "bg-success/15 text-success",
  busy: "bg-warning/20 text-warning-foreground",
  on_leave: "bg-muted text-muted-foreground",
};

function TeamPage() {
  const qc = useQueryClient();
  const { data: me } = useCurrentUser();
  const isSuper = me?.roles?.includes("super_admin") ?? false;
  const [target, setTarget] = useState<any | null>(null);

  const remove = useMutation({
    mutationFn: (id: string) => deleteUser({ data: { id } }),
    onSuccess: () => {
      toast.success("Account deleted");
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["all-members-roles"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e: Error) => { toast.error(e.message); setTarget(null); },
  });

  // Only a super admin can delete accounts (admins cannot). Nobody deletes themselves.
  const canDelete = (m: any) => isSuper && m.id !== me?.user.id;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => getTeamWithWorkload(),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-muted-foreground">Click any member to see their details, tasks and projects.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <TeamCardSkeleton key={i} />)}
        {members.map((m: any) => {
          const display = m.full_name ?? "Team member";
          const initials = display.split(" ").map((s: string) => s[0]).join("").slice(0, 2).toUpperCase();
          return (
            <div key={m.id} className="relative">
              {canDelete(m) && (
                <Button variant="ghost" size="icon" title="Delete account"
                  className="absolute top-2 right-2 z-10 h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => setTarget(m)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              <Link
                to="/team/$id"
                params={{ id: m.id }}
                className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
              >
                <Card className="p-5 hover:bg-accent/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{initials}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{display}</p>
                      <p className="text-xs text-muted-foreground truncate">{m.designation ?? "—"}</p>
                    </div>
                    <Badge variant="secondary" className={`${availabilityColor[m.availability]} ${canDelete(m) ? "mr-8" : ""}`}>
                      {m.availability.replace("_", " ")}
                    </Badge>
                  </div>
                  {m.department && (
                    <div className="mt-4 space-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2"><Briefcase className="h-3 w-3" /> {m.department}</div>
                    </div>
                  )}
                  <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{m.activeTasks} active tasks</p>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Card>
              </Link>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => { if (!o && !remove.isPending) setTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete <b>{target?.full_name ?? "this member"}</b>? They will no longer be able to sign in,
              and their daily logs will be removed. Their tasks, phases and projects stay but become unassigned. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={remove.isPending}
              onClick={(e) => { e.preventDefault(); if (target) remove.mutate(target.id); }}>
              {remove.isPending ? "Deleting…" : "Yes, delete account"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}