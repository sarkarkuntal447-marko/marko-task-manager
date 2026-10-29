import { Link, useRouterState } from "@tanstack/react-router";
import { Users, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEPARTMENTS } from "@/lib/types";
import type { DepartmentFilterValue } from "@/lib/format";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const tabs = [
  { to: "/team", label: "Team List", icon: Users },
  { to: "/team/members", label: "Member Management", icon: UserCog },
] as const;

/** Sub-navigation for the Team section. Everyone sees both; only a super admin can make changes. */
export function TeamTabs() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="inline-flex w-full sm:w-auto rounded-lg bg-muted p-1 text-muted-foreground">
      {tabs.map((t) => {
        const active = pathname.replace(/\/$/, "") === t.to;
        const Icon = t.icon;
        return (
          <Link
            key={t.to}
            to={t.to}
            className={cn(
              "flex flex-1 sm:flex-none items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-all",
              active ? "bg-background text-foreground shadow" : "hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

export function DepartmentFilter({
  value,
  onChange,
  className,
}: {
  value: DepartmentFilterValue;
  onChange: (v: DepartmentFilterValue) => void;
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DepartmentFilterValue)}>
      <SelectTrigger className={cn("w-full sm:w-44", className)} title="Filter by department">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All departments</SelectItem>
        {DEPARTMENTS.map((d) => (
          <SelectItem key={d} value={d}>
            {d}
          </SelectItem>
        ))}
        <SelectItem value="none">Not set</SelectItem>
      </SelectContent>
    </Select>
  );
}
