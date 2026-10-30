// Project types and their status workflows. Tech and SEO projects move through different stages;
// each type's stages (minus "On Hold") double as its default phases.
export const PROJECT_TYPES = ["tech", "seo"] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = { tech: "Tech", seo: "SEO" };

export const TECH_STATUSES = [
  "requirement_analysis",
  "ui_ux_design",
  "dev_flow_architecture",
  "dev_implementation",
  "testing_deployment",
  "complete_delivered",
  "complete_maintenance",
  "maintenance_new_feature",
  "on_hold",
] as const;

export const SEO_STATUSES = [
  "requirement_handover",
  "workflow_roadmap",
  "scope_of_work",
  "migration_testing",
  "maintenance_optimisation",
  "on_hold",
] as const;

export const PROJECT_STATUSES = [...new Set([...TECH_STATUSES, ...SEO_STATUSES])] as [
  ProjectStatus,
  ...ProjectStatus[],
];
export type ProjectStatus = (typeof TECH_STATUSES)[number] | (typeof SEO_STATUSES)[number];

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  requirement_analysis: "Requirement Analysis",
  ui_ux_design: "UI/UX Design",
  dev_flow_architecture: "Development Flow & Architecture",
  dev_implementation: "Development Implementation",
  testing_deployment: "Testing & Deployment",
  complete_delivered: "Complete & Delivered",
  complete_maintenance: "Complete & Maintenance",
  maintenance_new_feature: "Maintenance & New Feature/Update",
  requirement_handover: "Requirement Gathering & Handover",
  workflow_roadmap: "Workflow & Roadmap",
  scope_of_work: "Scope of Work",
  migration_testing: "Migration-based Testing",
  maintenance_optimisation: "Maintenance & Optimisation",
  on_hold: "On Hold",
};

export const statusesFor = (type: ProjectType): readonly ProjectStatus[] =>
  type === "seo" ? SEO_STATUSES : TECH_STATUSES;

/** Projects saved before types existed are Tech projects. */
export const projectTypeOf = (p: { project_type?: ProjectType | null }): ProjectType =>
  p.project_type ?? "tech";

/** Default phases for a new project: every stage of its workflow except "On Hold". */
export const defaultPhasesFor = (type: ProjectType): string[] =>
  statusesFor(type)
    .filter((s) => s !== "on_hold")
    .map((s) => PROJECT_STATUS_LABEL[s]);

/** Stages where the work has been handed over (delivered, or now in maintenance). */
export const DELIVERED_STATUSES: readonly ProjectStatus[] = [
  "complete_delivered",
  "complete_maintenance",
  "maintenance_new_feature",
  "maintenance_optimisation",
];
export const isDelivered = (status: string) =>
  (DELIVERED_STATUSES as readonly string[]).includes(status);
/** Still being worked towards delivery: not delivered and not on hold. */
export const isActive = (status: string) => !isDelivered(status) && status !== "on_hold";

/** Departments that can work on a project of this type ("Tech & SEO" people can do both). */
export const departmentsFor = (type: ProjectType): string[] =>
  type === "seo" ? ["SEO", "Tech & SEO"] : ["Tech", "Tech & SEO"];
const sameDept = (a: string, b?: string | null) =>
  a.toLowerCase() === (b ?? "").trim().toLowerCase();
export const canWorkOn = (type: ProjectType, department?: string | null) =>
  departmentsFor(type).some((d) => sameDept(d, department));

/**
 * Project types someone may see, by their department: Tech people see Tech projects, SEO people
 * SEO projects, "Tech & SEO" people both. A super admin with no department set sees everything,
 * so the first account is never locked out.
 */
export const visibleProjectTypes = (
  department?: string | null,
  isSuperAdmin = false,
): ProjectType[] => {
  const types = PROJECT_TYPES.filter((t) => canWorkOn(t, department));
  return types.length || !isSuperAdmin ? types : [...PROJECT_TYPES];
};

/**
 * Whose tasks an admin may see, by the admin's own department: Tech admins see Tech people,
 * SEO admins see SEO people, "Tech & SEO" admins see both. "Tech & SEO" people count as both.
 */
export const canSeeTasksOf = (viewerDept?: string | null, memberDept?: string | null) => {
  if (sameDept("Tech & SEO", viewerDept))
    return canWorkOn("tech", memberDept) || canWorkOn("seo", memberDept);
  if (sameDept("Tech", viewerDept)) return canWorkOn("tech", memberDept);
  if (sameDept("SEO", viewerDept)) return canWorkOn("seo", memberDept);
  return false;
};
