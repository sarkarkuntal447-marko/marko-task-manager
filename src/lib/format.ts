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

export const fmtDate = (d?: string | null) =>
  d
    ? new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : "—";
