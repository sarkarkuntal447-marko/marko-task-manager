import type { Availability, Department } from "./types";

export const statusLabel = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const statusColor = (s: string): string => {
  const map: Record<string, string> = {
    planning: "bg-muted text-muted-foreground",
    requirement_gathering: "bg-info/10 text-info",
    design: "bg-chart-5/15 text-chart-5",
    development: "bg-primary/10 text-primary",
    api_integration: "bg-primary/10 text-primary",
    crm_integration: "bg-primary/10 text-primary",
    testing: "bg-warning/15 text-warning-foreground",
    deployment: "bg-info/15 text-info",
    client_review: "bg-warning/15 text-warning-foreground",
    maintenance: "bg-muted text-muted-foreground",
    completed: "bg-success/15 text-success",
    on_hold: "bg-muted text-muted-foreground",
    cancelled: "bg-destructive/10 text-destructive",
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-info/15 text-info",
    blocked: "bg-destructive/10 text-destructive",
    not_started: "bg-muted text-muted-foreground",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
};

export const priorityColor = (p: string): string =>
  ({
    low: "bg-muted text-muted-foreground",
    medium: "bg-info/10 text-info",
    high: "bg-warning/15 text-warning-foreground",
    critical: "bg-destructive/10 text-destructive",
  })[p] ?? "bg-muted text-muted-foreground";

const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "Available",
  busy: "Busy",
  on_leave: "On Leave",
  focus: "Focus",
  wfh: "Work From Home",
};

// Icon file names in /public/statuses, where they differ from the value itself.
const AVAILABILITY_ICON: Partial<Record<Availability, string>> = {
  on_leave: "on-leave",
  wfh: "work-from-home",
};

export const availabilityLabel = (a?: string | null): string =>
  a ? (AVAILABILITY_LABEL[a as Availability] ?? a) : "";

/** Status icon shipped in /public/statuses (e.g. on_leave → status-on-leave.svg). */
export const availabilityIcon = (a?: string | null): string => {
  const value = (a && a in AVAILABILITY_LABEL ? a : "available") as Availability;
  return `/statuses/status-${AVAILABILITY_ICON[value] ?? value}.svg`;
};

export const maintenableColor = (m: boolean): string =>
  m ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive";

export const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";

export type DepartmentFilterValue = "all" | "none" | Department;

/** True when a member's department passes the selected filter ("none" = not set). */
export function matchesDepartment(
  department: string | null | undefined,
  filter: DepartmentFilterValue,
) {
  const d = department?.trim() ?? "";
  if (filter === "all") return true;
  if (filter === "none") return !d;
  return d.toLowerCase() === filter.toLowerCase();
}
