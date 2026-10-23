import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { getDb } from "./mongodb.server";
import { hashPassword, verifyPassword, signSession, setSessionCookie } from "./auth.server";
import {
  ADMINS, STAFF, clean, checkUsers, hasAnyRole, logActivity, now, requireRole, rolesOf, type Context,
} from "./access.server";
import { listProjects } from "./projects.server";
import type {
  AppRole, DailyLogDoc, ActivityDoc, ProfileDoc, ProjectMemberDoc, TaskDoc, UserDoc, UserRoleDoc,
} from "./types";

const normEmail = (email: string) => email.trim().toLowerCase();
const primaryRole = (roles: AppRole[]): AppRole =>
  (["super_admin", "admin", "moderator"] as const).find(r => roles.includes(r)) ?? "developer";

// ---------- auth ----------
export async function login(emailInput: string, password: string) {
  const db = await getDb();
  const user = await db.collection<UserDoc>("users").findOne({ email: normEmail(emailInput) });
  // Same message for unknown email and wrong password.
  if (!user || !(await verifyPassword(password, user.password_hash))) throw new Error("Invalid email or password.");
  setSessionCookie(signSession(user.id));
  return { id: user.id };
}

export function logout() {
  setSessionCookie(null);
  return { ok: true };
}

export async function getMe(userId: string) {
  const db = await getDb();
  const [user, profile, roles] = await Promise.all([
    db.collection<UserDoc>("users").findOne({ id: userId }),
    db.collection<ProfileDoc>("profiles").findOne({ id: userId }),
    rolesOf(userId, db),
  ]);
  if (!user) throw new Error("Unauthorized: please sign in again.");
  return {
    user: { id: user.id, email: user.email },
    profile: profile ? clean(profile) : null,
    roles,
    role: primaryRole(roles),
  };
}

export async function createUser(
  context: Context,
  input: { email: string; password: string; full_name: string; role: AppRole; designation?: string; department?: string },
) {
  await requireRole(context);
  const callerRoles = await rolesOf(context.userId);
  if (input.role === "super_admin" && !callerRoles.includes("super_admin")) {
    throw new Error("Only super admin can create super admin");
  }
  const db = await getDb();
  const email = normEmail(input.email);
  if (await db.collection<UserDoc>("users").findOne({ email })) throw new Error("A user with this email already exists.");
  const id = randomUUID();
  const timestamp = now();
  await db.collection<UserDoc>("users").insertOne({ id, email, password_hash: await hashPassword(input.password), created_at: timestamp });
  const profile: ProfileDoc = {
    id, email, full_name: input.full_name, avatar_url: null, designation: input.designation ?? null,
    department: input.department ?? null, phone: null, joining_date: null, skills: null,
    availability: "available", created_at: timestamp, updated_at: timestamp,
  };
  await db.collection<ProfileDoc>("profiles").insertOne(profile);
  await db.collection<UserRoleDoc>("user_roles").insertOne({ id: randomUUID(), user_id: id, role: input.role, created_at: timestamp });
  await logActivity(id, "member.joined", "profile", id, input.full_name || email);
  return { id };
}

// ---------- profiles / team ----------
export async function updateMyProfile(
  context: Context,
  changes: Partial<Pick<ProfileDoc, "full_name" | "designation" | "department" | "phone" | "joining_date" | "availability">>,
) {
  const db = await getDb();
  await db.collection<ProfileDoc>("profiles").updateOne({ id: context.userId }, { $set: { ...changes, updated_at: now() } });
  return { id: context.userId };
}

// Directory fields only; email/phone stay private.
const directoryFields = { id: 1, full_name: 1, designation: 1, department: 1, availability: 1, avatar_url: 1, joining_date: 1, created_at: 1 } as const;

export async function teamDirectory(context: Context) {
  const db = await getDb();
  const staff = await hasAnyRole(context.userId, STAFF);
  const rows = await db.collection<ProfileDoc>("profiles")
    .find({}, { projection: { _id: 0, ...directoryFields, ...(staff ? { email: 1 } : {}) } })
    .sort({ created_at: 1 }).toArray();
  return rows as Array<Partial<ProfileDoc> & Pick<ProfileDoc, "id" | "full_name" | "designation" | "department" | "availability" | "created_at">>;
}

export async function teamWithWorkload(context: Context) {
  const db = await getDb();
  const [members, open] = await Promise.all([
    teamDirectory(context),
    db.collection<TaskDoc>("tasks").aggregate<{ _id: string; n: number }>([
      { $match: { status: { $ne: "completed" }, assigned_to: { $ne: null } } },
      { $group: { _id: "$assigned_to", n: { $sum: 1 } } },
    ]).toArray(),
  ]);
  const counts = new Map(open.map(o => [o._id, o.n]));
  // Roles are only sent to admins (they need them to decide who they may remove).
  const isAdmin = await hasAnyRole(context.userId, ADMINS);
  const roleRows = isAdmin ? await db.collection<UserRoleDoc>("user_roles").find({}).toArray() : [];
  return members.map(m => ({
    ...m, activeTasks: counts.get(m.id) ?? 0,
    roles: isAdmin ? roleRows.filter(r => r.user_id === m.id).map(r => r.role) : undefined,
  }));
}

export async function getMember(context: Context, id: string) {
  const db = await getDb();
  const member = (await teamDirectory(context)).find(m => m.id === id) ?? null;
  if (!member) return null;
  const [tasks, projects, memberships] = await Promise.all([
    listAllTasks({ assigned_to: id }),
    listProjects(),
    db.collection<ProjectMemberDoc>("project_members").find({ user_id: id }).toArray(),
  ]);
  return { member, tasks, projects, memberships: memberships.map(m => m.project_id) };
}

export async function getDashboard(context: Context) {
  const db = await getDb();
  const [projects, tasks, profiles] = await Promise.all([
    listProjects(),
    db.collection<TaskDoc>("tasks").find({}, { projection: { _id: 0, status: 1, priority: 1 } }).toArray(),
    teamDirectory(context),
  ]);
  return { projects, tasks, profiles };
}

// ---------- tasks ----------
export async function listAllTasks(filter: { assigned_to?: string } = {}) {
  const db = await getDb();
  const tasks = await db.collection<TaskDoc>("tasks").find(filter).sort({ created_at: -1 }).toArray();
  const ids = [...new Set(tasks.map(t => t.project_id).filter((x): x is string => !!x))];
  const names = new Map(
    (await db.collection<{ id: string; name: string }>("projects").find({ id: { $in: ids } }, { projection: { id: 1, name: 1 } }).toArray())
      .map(p => [p.id, p.name]),
  );
  const phaseIds = [...new Set(tasks.map(t => t.phase_id).filter((x): x is string => !!x))];
  const phaseNames = new Map(
    (await db.collection<{ id: string; name: string }>("project_phases").find({ id: { $in: phaseIds } }, { projection: { id: 1, name: 1 } }).toArray())
      .map(p => [p.id, p.name]),
  );
  return tasks.map(t => ({
    ...clean(t),
    projects: t.project_id && names.has(t.project_id) ? { name: names.get(t.project_id)! } : null,
    phase: t.phase_id && phaseNames.has(t.phase_id) ? { name: phaseNames.get(t.phase_id)! } : null,
  }));
}

type NewTask = Pick<TaskDoc, "name"> & Partial<Pick<TaskDoc, "description" | "project_id" | "phase_id" | "priority" | "status" | "due_date">>;

// A user may add a task to their own list; staff may too.
export async function createTask(context: Context, input: NewTask) {
  const db = await getDb();
  if (input.project_id && !(await db.collection("projects").findOne({ id: input.project_id, archived_at: null }))) {
    throw new Error("Project not found.");
  }
  // A phase belongs to a project, so it can only be chosen together with that project.
  if (input.phase_id) {
    if (!input.project_id) throw new Error("Choose a project before choosing a phase.");
    if (!(await db.collection("project_phases").findOne({ id: input.phase_id, project_id: input.project_id }))) {
      throw new Error("Phase not found in this project.");
    }
  }
  const timestamp = now();
  const task: TaskDoc = {
    id: randomUUID(), project_id: input.project_id ?? null, phase_id: input.phase_id ?? null, name: input.name, description: input.description ?? null,
    assigned_to: context.userId, due_date: input.due_date ?? null, priority: input.priority ?? "medium",
    status: input.status ?? "pending", estimated_hours: null, actual_hours: null, notes: null,
    created_by: context.userId, created_at: timestamp, updated_at: timestamp,
  };
  await db.collection<TaskDoc>("tasks").insertOne(task);
  await logActivity(context.userId, "task.created", "task", task.id, task.name, { assigned_to: task.assigned_to, project_id: task.project_id });
  return { id: task.id };
}

export async function updateTask(
  context: Context, id: string,
  changes: Partial<Pick<TaskDoc, "name" | "description" | "priority" | "status" | "due_date">>,
) {
  const db = await getDb();
  const tasks = db.collection<TaskDoc>("tasks");
  const task = await tasks.findOne({ id });
  if (!task) throw new Error("Task not found.");
  // Only the person who created the task may edit it.
  if (task.created_by !== context.userId) {
    throw new Error("Only the person who created this task can edit it.");
  }
  await tasks.updateOne({ id }, { $set: { ...changes, updated_at: now() } });
  if (changes.status && changes.status !== task.status) {
    await logActivity(context.userId, "task.status_changed", "task", id, changes.name ?? task.name, { from: task.status, to: changes.status });
  }
  return { id };
}

export async function deleteTask(context: Context, id: string) {
  const db = await getDb();
  const task = await db.collection<TaskDoc>("tasks").findOne({ id });
  if (!task) throw new Error("Task not found.");
  // Only the person who created the task may delete it.
  if (task.created_by !== context.userId) {
    throw new Error("Only the person who created this task can delete it.");
  }
  await db.collection<TaskDoc>("tasks").deleteOne({ id });
  await db.collection<DailyLogDoc>("daily_logs").updateMany({ task_id: id }, { $set: { task_id: null } });
  return { id };
}

// ---------- logs / activity ----------
export async function listActivity(opts: { since?: string; limit?: number }) {
  const db = await getDb();
  const filter = opts.since ? { created_at: { $gte: opts.since } } : {};
  const rows = await db.collection<ActivityDoc>("activity_log").find(filter).sort({ created_at: -1 }).limit(opts.limit ?? 500).toArray();
  return rows.map(clean);
}

export async function listDailyLogs(context: Context, opts: { dates?: string[] }) {
  const db = await getDb();
  const staff = await hasAnyRole(context.userId, STAFF);
  const filter: Record<string, unknown> = {};
  if (!staff) filter.user_id = context.userId;
  if (opts.dates) filter.log_date = { $in: opts.dates };
  const logs = await db.collection<DailyLogDoc>("daily_logs").find(filter).sort({ log_date: -1, created_at: -1 }).toArray();
  const projectIds = [...new Set(logs.map(l => l.project_id).filter((x): x is string => !!x))];
  const userIds = [...new Set(logs.map(l => l.user_id))];
  const [projects, profiles] = await Promise.all([
    db.collection<{ id: string; name: string }>("projects").find({ id: { $in: projectIds } }, { projection: { id: 1, name: 1 } }).toArray(),
    db.collection<ProfileDoc>("profiles").find({ id: { $in: userIds } }, { projection: { id: 1, full_name: 1, email: 1 } }).toArray(),
  ]);
  const pn = new Map(projects.map(p => [p.id, p.name]));
  const pr = new Map(profiles.map(p => [p.id, p]));
  return logs.map(l => ({
    ...clean(l),
    projects: l.project_id && pn.has(l.project_id) ? { name: pn.get(l.project_id)! } : null,
    profiles: pr.has(l.user_id) ? { full_name: pr.get(l.user_id)!.full_name, email: pr.get(l.user_id)!.email } : null,
  }));
}

export async function createDailyLog(
  context: Context,
  input: Pick<DailyLogDoc, "log_date" | "task_name"> & Partial<Pick<DailyLogDoc, "project_id" | "priority" | "status" | "hours" | "notes">>,
) {
  const db = await getDb();
  const timestamp = now();
  const log: DailyLogDoc = {
    id: randomUUID(), user_id: context.userId, project_id: input.project_id ?? null, task_id: null,
    log_date: input.log_date, task_name: input.task_name, priority: input.priority ?? "medium",
    status: input.status ?? "in_progress", hours: input.hours ?? null, notes: input.notes ?? null,
    created_at: timestamp, updated_at: timestamp,
  };
  await db.collection<DailyLogDoc>("daily_logs").insertOne(log);
  return { id: log.id };
}

// ---------- remove an account ----------
export async function deleteUser(context: Context, targetId: string) {
  await requireRole(context);
  if (targetId === context.userId) throw new Error("You cannot delete your own account.");
  const db = await getDb();
  const target = await db.collection<UserDoc>("users").findOne({ id: targetId });
  if (!target) throw new Error("Account not found.");
  const [callerRoles, targetRoles] = await Promise.all([rolesOf(context.userId, db), rolesOf(targetId, db)]);
  const callerIsSuper = callerRoles.includes("super_admin");
  if ((targetRoles.includes("admin") || targetRoles.includes("super_admin")) && !callerIsSuper) {
    throw new Error("Only a super admin can delete an admin or super admin account.");
  }
  if (targetRoles.includes("super_admin") &&
    (await db.collection<UserRoleDoc>("user_roles").countDocuments({ role: "super_admin" })) <= 1) {
    throw new Error("You cannot delete the last super admin.");
  }
  const profile = await db.collection<ProfileDoc>("profiles").findOne({ id: targetId });
  const name = profile?.full_name ?? profile?.email ?? target.email;

  // Remove the person; keep their tasks/phases/projects but un-assign them (history stays intact).
  await Promise.all([
    db.collection("users").deleteOne({ id: targetId }),
    db.collection("profiles").deleteOne({ id: targetId }),
    db.collection("user_roles").deleteMany({ user_id: targetId }),
    db.collection("project_members").deleteMany({ user_id: targetId }),
    db.collection("daily_logs").deleteMany({ user_id: targetId }),
    db.collection("tasks").updateMany({ assigned_to: targetId }, { $set: { assigned_to: null } }),
    db.collection("project_phases").updateMany({ assigned_to: targetId }, { $set: { assigned_to: null } }),
    db.collection("projects").updateMany({ lead_id: targetId }, { $set: { lead_id: null } }),
    db.collection("projects").updateMany({ maintainer_id: targetId }, { $set: { maintainer_id: null } }),
    db.collection("activity_log").updateMany({ actor_id: targetId }, { $set: { actor_id: null } }),
  ]);
  await logActivity(context.userId, "member.removed", "profile", targetId, name);
  return { id: targetId };
}

// ---------- roles (super admin only) ----------
export async function listRoleMembers(context: Context) {
  await requireRole(context, ["super_admin"]);
  const db = await getDb();
  const [profiles, roles] = await Promise.all([
    db.collection<ProfileDoc>("profiles").find({}, { projection: { _id: 0, ...directoryFields } }).sort({ created_at: 1 }).toArray(),
    db.collection<UserRoleDoc>("user_roles").find({}).toArray(),
  ]);
  return profiles.map(p => ({ ...p, roles: roles.filter(r => r.user_id === p.id).map(clean) }));
}

export async function addRole(context: Context, userId: string, role: AppRole) {
  await requireRole(context, ["super_admin"]);
  await checkUsers([userId]);
  const db = await getDb();
  if (await db.collection<UserRoleDoc>("user_roles").findOne({ user_id: userId, role })) throw new Error("User already has this role.");
  await db.collection<UserRoleDoc>("user_roles").insertOne({ id: randomUUID(), user_id: userId, role, created_at: now() });
  const target = await db.collection<ProfileDoc>("profiles").findOne({ id: userId });
  await logActivity(context.userId, "role.assigned", "user_role", userId, target?.full_name ?? target?.email ?? null, { role });
  return { userId };
}

export async function removeRole(context: Context, id: string) {
  await requireRole(context, ["super_admin"]);
  const db = await getDb();
  const roles = db.collection<UserRoleDoc>("user_roles");
  const doc = await roles.findOne({ id });
  if (!doc) throw new Error("Role not found.");
  if (doc.role === "super_admin" && (await roles.countDocuments({ role: "super_admin" })) <= 1) {
    throw new Error("You cannot remove the last super admin.");
  }
  await roles.deleteOne({ id });
  return { id };
}