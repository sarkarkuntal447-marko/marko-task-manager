import type { Availability, Department } from "./types";
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "./project-status";

export const statusLabel = (s: string) =>
  PROJECT_STATUS_LABEL[s as ProjectStatus] ??
  s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

export const statusColor = (s: string): string => {
  const map: Record<string, string> = {
    // Tech project stages
    requirement_analysis: "bg-info/10 text-info",
    ui_ux_design: "bg-chart-5/15 text-chart-5",
    dev_flow_architecture: "bg-primary/10 text-primary",
    dev_implementation: "bg-primary/10 text-primary",
    testing_deployment: "bg-warning/15 text-warning-foreground",
    complete_delivered: "bg-success/15 text-success",
    complete_maintenance: "bg-success/15 text-success",
    maintenance_new_feature: "bg-info/15 text-info",
    // SEO project stages
    requirement_handover: "bg-info/10 text-info",
    workflow_roadmap: "bg-chart-5/15 text-chart-5",
    scope_of_work: "bg-primary/10 text-primary",
    migration_testing: "bg-warning/15 text-warning-foreground",
    maintenance_optimisation: "bg-success/15 text-success",
    on_hold: "bg-muted text-muted-foreground",
    // phases and tasks
    completed: "bg-success/15 text-success",
    pending: "bg-muted text-muted-foreground",
    in_progress: "bg-info/15 text-info",
    blocked: "bg-destructive/10 text-destructive",
    not_started: "bg-muted text-muted-foreground",
  };
  return map[s] ?? "bg-muted text-muted-foreground";
};

export const priorityColor = (p: string): string =>
  ({
    low: "bg-[var(--status-live-background)] text-[var(--status-live-foreground)]",
    medium: "bg-info/10 text-info",
    high: "bg-[var(--status-maintenance-background)] text-[var(--status-maintenance-foreground)]",
    critical: "bg-destructive/10 text-destructive",
  })[p] ?? "bg-muted text-muted-foreground";

/** "high" → "High". */
export const priorityLabel = (p: string) => p.charAt(0).toUpperCase() + p.slice(1);

/** Department badge: Tech projects green, SEO projects blue. */
export const projectTypeColor = (type: string): string =>
  type === "seo"
    ? "border-info/40 bg-info/10 text-info"
    : "border-success/40 bg-success/10 text-success";

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

/** Today's date on this device as YYYY-MM-DD (local time, not UTC). */
export const todayStr = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

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
