import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireAuth } from "./auth-middleware";
import { AVAILABILITY, DEPARTMENTS, PRIORITIES, TASK_STATUSES } from "./types";

const id = z.string().trim().min(1).max(100);
const text = z.string().trim().max(10000);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const priority = z.enum(PRIORITIES);
const taskStatus = z.enum(TASK_STATUSES);
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

// Only ever the caller's own password (the id comes from the session).
export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        current_password: z.string().min(1).max(200),
        new_password: z.string().min(6).max(200),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    (await srv()).changeMyPassword(context, data.current_password, data.new_password),
  );

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
        department: z.enum(DEPARTMENTS).optional(),
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
        // No department: it decides what you can see, so only a super admin changes it.
        phone: text.max(50).nullable(),
        joining_date: date.nullable(),
        availability: z.enum(AVAILABILITY),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) => (await srv()).updateMyProfile(context, data));

// Quick status switch from the header menu (changes only availability).
export const setMyAvailability = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({ availability: z.enum(AVAILABILITY) })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    (await srv()).updateMyProfile(context, { availability: data.availability }),
  );

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

// Admins may edit any member; everyone else only themselves.
export const updateMemberProfile = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        id,
        changes: z
          .object({
            full_name: text.min(1).max(200),
            designation: text.max(200).nullable(),
            department: z.enum(DEPARTMENTS).nullable(),
            phone: text.max(50).nullable(),
          })
          .strict(),
      })
      .strict()
      .parse(d),
  )
  .handler(async ({ data, context }) =>
    (await srv()).updateMemberProfile(context, data.id, data.changes),
  );

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).getDashboard(context));

// ---- tasks (each person's daily work log) ----
const taskFields = z
  .object({
    task_date: date,
    project_id: id,
    name: text.min(1),
    priority,
    status: taskStatus,
    start_date: date.nullable(),
    end_date: date.nullable(),
    notes: text.nullable(),
  })
  .strict();

export const listMyTasks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).listMyTasks(context));

// Admins and super admins: tasks of the people in their department.
export const listTeamTasks = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).listTeamTasks(context));

// Projects the current user may log tasks against.
export const listTaskProjects = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).listTaskProjects(context));

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => taskFields.parse(d))
  .handler(async ({ data, context }) => (await srv()).createTask(context, data));

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) =>
    z
      .object({
        id,
        changes: taskFields
          .partial()
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
// Full workspace activity history for the Application Logs page (Admin / Super Admin only).
export const listApplicationLogs = createServerFn({ method: "GET" })
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
  .handler(async ({ data, context }) => (await srv()).listApplicationLogs(context, data));

// ---- member management (Admin / Super Admin) ----
export const listMembers = createServerFn({ method: "GET" })
  .middleware([requireAuth])
  .handler(async ({ context }) => (await srv()).listMembers(context));

export const setMemberRole = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ userId: id, role }).strict().parse(d))
  .handler(async ({ data, context }) =>
    (await srv()).setMemberRole(context, data.userId, data.role),
  );

export const setMemberActive = createServerFn({ method: "POST" })
  .middleware([requireAuth])
  .validator((d: unknown) => z.object({ userId: id, active: z.boolean() }).strict().parse(d))
  .handler(async ({ data, context }) =>
    (await srv()).setMemberActive(context, data.userId, data.active),
  );
