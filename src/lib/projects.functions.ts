import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware";
import { PROJECT_STATUSES, PROJECT_TYPES } from "./project-status";

const id = z.string().trim().min(1).max(100);
const nullableText = z.string().trim().max(10000).nullable();
const userId = z.string().uuid().nullable();
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(value + "T00:00:00Z");
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
  }, "Invalid date")
  .nullable();
const priority = z.enum(["low", "medium", "high", "critical"]);
// Which statuses fit which project type is checked on the server, where the type is known.
const status = z.enum(PROJECT_STATUSES);
export const projectFields = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: nullableText.optional(),
    client_name: nullableText.optional(),
    client_company: nullableText.optional(),
    client_email: z
      .union([z.literal(""), z.string().email()])
      .nullable()
      .optional(),
    client_phone: nullableText.optional(),
    start_date: date.optional(),
    expected_delivery_date: date.optional(),
    actual_delivery_date: date.optional(),
    status: status.optional(),
    priority: priority.optional(),
    notes: nullableText.optional(),
    technology_stack: z.array(z.string().trim().min(1).max(100)).max(100).nullable().optional(),
    lead_id: userId.optional(),
  })
  .strict();
// The type is chosen once, at creation: statuses, phases and team all depend on it.
export const projectSchema = projectFields.extend({ project_type: z.enum(PROJECT_TYPES) });
export const phaseSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    assigned_to: userId.optional(),
    start_date: date.optional(),
    end_date: date.optional(),
    notes: nullableText.optional(),
    status: z.enum(["not_started", "in_progress", "completed", "blocked"]).optional(),
  })
  .strict();
const projectId = z.object({ id }).strict();
const relatedId = z.object({ projectId: id }).strict();

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await import("./projects.server")).listProjects(context));

export const getProject = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data: unknown) => projectId.parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).getProject(context, data.id),
  );

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) => projectSchema.parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).createProject(context, data),
  );

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) =>
    z
      .object({
        id,
        changes: projectFields
          .partial()
          .refine((v) => Object.keys(v).length > 0, "No changes supplied"),
      })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).updateProject(context, data.id, data.changes),
  );

export const listProjectPhases = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data: unknown) => relatedId.parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).listProjectPhases(context, data.projectId),
  );

export const createProjectPhase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) =>
    z.object({ projectId: id, phase: phaseSchema }).strict().parse(data),
  )
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).createProjectPhase(context, data.projectId, data.phase),
  );

export const updateProjectPhase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) =>
    z.object({ projectId: id, phaseId: id, changes: phaseSchema.partial() }).strict().parse(data),
  )
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).updateProjectPhase(
      context,
      data.projectId,
      data.phaseId,
      data.changes,
    ),
  );

export const deleteProjectPhase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) => z.object({ projectId: id, phaseId: id }).strict().parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).deleteProjectPhase(context, data.projectId, data.phaseId),
  );

export const seedProjectPhases = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) => relatedId.parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).seedProjectPhases(context, data.projectId),
  );

// Not-started and in-progress tasks logged against a project.
export const listOngoingTasks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data: unknown) => relatedId.parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).listOngoingTasks(context, data.projectId),
  );

export const listProjectMembers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((data: unknown) => relatedId.parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).listProjectMembers(context, data.projectId),
  );

export const addProjectMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) =>
    z.object({ projectId: id, userId: z.string().uuid() }).strict().parse(data),
  )
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).addProjectMember(context, data.projectId, data.userId),
  );

export const removeProjectMember = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) =>
    z.object({ projectId: id, userId: z.string().uuid() }).strict().parse(data),
  )
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).removeProjectMember(context, data.projectId, data.userId),
  );

const subPhaseIds = z.object({ projectId: id, phaseId: id });

export const addSubPhases = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) =>
    subPhaseIds
      .extend({
        names: z.array(z.string().trim().min(1).max(200)).min(1).max(50),
        start_date: date.optional(),
        end_date: date.optional(),
      })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).addSubPhases(
      context,
      data.projectId,
      data.phaseId,
      data.names,
      { start_date: data.start_date, end_date: data.end_date },
    ),
  );

export const updateSubPhase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) =>
    subPhaseIds
      .extend({
        subId: id,
        changes: z
          .object({
            name: z.string().trim().min(1).max(200),
            completed: z.boolean(),
            start_date: date,
            end_date: date,
          })
          .partial()
          .strict()
          .refine((v) => Object.keys(v).length > 0, "No changes supplied"),
      })
      .strict()
      .parse(data),
  )
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).updateSubPhase(
      context,
      data.projectId,
      data.phaseId,
      data.subId,
      data.changes,
    ),
  );

export const deleteSubPhase = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((data: unknown) => subPhaseIds.extend({ subId: id }).strict().parse(data))
  .handler(async ({ data, context }) =>
    (await import("./projects.server")).deleteSubPhase(
      context,
      data.projectId,
      data.phaseId,
      data.subId,
    ),
  );

export type ProjectInput = z.infer<typeof projectSchema>;
