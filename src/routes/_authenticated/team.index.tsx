import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { getTeamWithWorkload } from "@/lib/app.functions";
import { TeamCardSkeleton } from "@/components/skeletons";
import { DepartmentFilter, TeamTabs } from "@/components/team-tabs";
import { matchesDepartment, type DepartmentFilterValue } from "@/lib/format";
import { availabilityLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Briefcase, IdCardLanyard } from "lucide-react";
import { cn } from "@/lib/utils";
import { AvailabilityIcon, WithStatus } from "@/components/availability-status";

export const Route = createFileRoute("/_authenticated/team/")({
  head: () => ({ meta: [{ title: "Team — Marko Projects" }] }),
  component: TeamPage,
});

const availabilityColor: Record<string, string> = {
  available: "bg-success/15 text-success",
  busy: "bg-destructive/10 text-destructive",
  on_leave: "bg-warning/20 text-warning-foreground",
  focus: "bg-destructive/10 text-destructive",
  wfh: "bg-info/10 text-info",
};

function TeamPage() {
  const [dept, setDept] = useState<DepartmentFilterValue>("all");
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: () => getTeamWithWorkload(),
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-muted-foreground">
          Click any member to see their details, tasks and projects.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <TeamTabs />
        <DepartmentFilter value={dept} onChange={setDept} />
      </div>

      {!isLoading && members.every((m) => !matchesDepartment(m.department, dept)) && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No members in this department.
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading && Array.from({ length: 6 }).map((_, i) => <TeamCardSkeleton key={i} />)}
        {members
          .filter((m) => matchesDepartment(m.department, dept))
          .map((m) => {
            const display = m.full_name ?? "Team member";
            const initials = display
              .split(" ")
              .map((s: string) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <Link
                key={m.id}
                to="/team/$id"
                params={{ id: m.id }}
                className="block focus:outline-none focus:ring-2 focus:ring-ring rounded-lg"
              >
                <Card className="p-5 hover:bg-accent/40 transition-colors cursor-pointer">
                  <div className="flex items-start gap-3">
                    <WithStatus value={m.availability} size="md">
                      <Avatar className="h-12 w-12">
                        <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                    </WithStatus>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{display}</p>
                      <div className="mt-1 space-y-1 text-xs text-muted-foreground">
                        <p className="flex min-w-0 items-center gap-2">
                          <IdCardLanyard className="h-3 w-3 shrink-0" />
                          <span className={cn("truncate", !m.designation?.trim() && "italic")}>
                            {m.designation?.trim() || "Not mentioned"}
                          </span>
                        </p>
                        {/* Always shown so every card has the same height; em dash when not set. */}
                        <p className="flex min-w-0 items-center gap-2">
                          <Briefcase className="h-3 w-3 shrink-0" />
                          <span className="truncate">{m.department?.trim() || "—"}</span>
                        </p>
                      </div>
                    </div>
                    {/* Account status top-right; availability below it. */}
                    <div className="flex shrink-0 flex-col items-end gap-3 self-stretch justify-between">
                      <AccountStatus active={m.active} />
                      <Badge
                        variant="secondary"
                        className={cn("gap-1.5", availabilityColor[m.availability])}
                      >
                        <AvailabilityIcon value={m.availability} className="h-3.5 w-3.5" />
                        {availabilityLabel(m.availability)}
                      </Badge>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
      </div>
    </div>
  );
}

/** Account status from the user's `active` field: a status dot + label rather than a pill badge. */
function AccountStatus({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide",
        active ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
      )}
    >
      <span className="relative flex h-2 w-2">
        {active && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
        )}
        <span
          className={cn(
            "relative inline-flex h-2 w-2 rounded-full",
            active ? "bg-green-500" : "bg-red-500",
          )}
        />
      </span>
      {active ? "Active" : "Non-Active"}
    </span>
  );
}
