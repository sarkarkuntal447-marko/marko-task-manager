import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware";

const id = z.string().trim().min(1).max(100);
const text = z.string().trim().max(10000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const priority = z.enum(["low", "medium", "high", "critical"]);
const taskStatus = z.enum(["pending", "in_progress", "blocked", "testing", "completed"]);
const role = z.enum(["Developer", "SEO", "Admin", "Super_Admin"]);
const srv = () => import("./app.server");

// ---- auth (login/logout/session are the only unauthenticated entry points) ----
export const login = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({ email: z.string().email(), password: z.string().min(1).max(200) })
      .strict()
      .parse(d),
  )
  .handler(async ({ data }) => (await srv()).login(data.email, data.password));

export const logout = createServerFn({ method: "POST" }).handler(async () =>
  (await srv()).logout(),
);

// Returns null when signed out (used for route guards).
export const getSession = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUserId } = await import("./auth.server");
  const userId = await currentUserId();
  return userId ? (await srv()).getMe(userId) : null;
});

export const createUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).max(200),
        full_name: z.string().trim().min(1).max(200),
        role: role.default("Developer"),
        designation: z.string().trim().max(200).optional(),
        department: z.string().trim().max(200).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => (await srv()).createUser(context, data));

// ---- profile / team ----
export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        full_name: text.max(200).nullable(),
        designation: text.max(200).nullable(),
        department: text.max(200).nullable(),
        phone: text.max(50).nullable(),
        joining_date: date.nullable(),
        availability: z.enum(["available", "busy", "on_leave"]),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => (await srv()).updateMyProfile(context, data));

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id }).strict().parse(d))
  .handler(async ({ data, context }) => (await srv()).deleteUser(context, data.id));

export const getTeamDirectory = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).teamDirectory(context));

export const getTeamWithWorkload = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).teamWithWorkload(context));

export const getMember = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id }).strict().parse(d))
  .handler(async ({ data, context }) => (await srv()).getMember(context, data.id));

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).getDashboard(context));

// ---- tasks ----
export const listAllTasks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async () => (await srv()).listAllTasks());

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(200),
        description: text.nullable().optional(),
        project_id: id.nullable().optional(),
        phase_id: id.nullable().optional(),
        priority: priority.optional(),
        status: taskStatus.optional(),
        due_date: date.nullable().optional(),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => (await srv()).createTask(context, data));

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        id,
        changes: z
          .object({
            name: z.string().trim().min(1).max(200),
            description: text.nullable(),
            priority,
            status: taskStatus,
            due_date: date.nullable(),
          })
          .partial()
          .strict()
          .refine((v) => Object.keys(v).length > 0, "No changes supplied"),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => (await srv()).updateTask(context, data.id, data.changes));

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id }).strict().parse(d))
  .handler(async ({ data, context }) => (await srv()).deleteTask(context, data.id));

// ---- logs / activity ----
export const listActivity = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        since: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data }) => (await srv()).listActivity(data));

export const listDailyLogs = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({ dates: z.array(date).max(10).optional() })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => (await srv()).listDailyLogs(context, data));

export const createDailyLog = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        log_date: date,
        task_name: z.string().trim().min(1).max(200),
        project_id: id.nullable().optional(),
        priority: priority.optional(),
        status: taskStatus.optional(),
        hours: z.number().min(0).max(1000).nullable().optional(),
        notes: text.nullable().optional(),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => (await srv()).createDailyLog(context, data));

// ---- roles ----
export const listRoleMembers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).listRoleMembers(context));

export const addRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ userId: id, role }).strict().parse(d))
  .handler(async ({ data, context }) => (await srv()).addRole(context, data.userId, data.role));

export const removeRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ id }).strict().parse(d))
  .handler(async ({ data, context }) => (await srv()).removeRole(context, data.id));
