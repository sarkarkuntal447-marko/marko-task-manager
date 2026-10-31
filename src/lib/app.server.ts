import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import type { Db, WithId } from "mongodb";
import { getDb } from "./mongodb.server";
import { hashPassword, verifyPassword, signSession, setSessionCookie } from "./auth.server";
import {
  ADMINS,
  STAFF,
  clean,
  checkUsers,
  hasAnyRole,
  logActivity,
  now,
  requireRole,
  rolesOf,
  type Context,
} from "./access.server";
import { listProjects, projectTypeFilter, projectTypesFor } from "./projects.server";
import { canSeeTasksOf, inDepartments } from "./project-status";
import type {
  AppRole,
  DailyLogDoc,
  ActivityDoc,
  ProfileDoc,
  ProjectDoc,
  ProjectMemberDoc,
  TaskDoc,
  UserDoc,
  UserRoleDoc,
} from "./types";

const normEmail = (email: string) => email.trim().toLowerCase();
const primaryRole = (roles: AppRole[]): AppRole =>
  (["Super_Admin", "Admin", "SEO"] as const).find((r) => roles.includes(r)) ?? "Developer";

// ---------- auth ----------
export async function login(emailInput: string, password: string) {
  const db = await getDb();
  const user = await db.collection<UserDoc>("users").findOne({ email: normEmail(emailInput) });
  // Same message for unknown email and wrong password.
  if (!user || !(await verifyPassword(password, user.password_hash)))
    throw new Error("Invalid email or password.");
  if (user.active === false)
    throw new Error("Your account has been disabled. Please contact an admin.");
  setSessionCookie(signSession(user.id));
  return { id: user.id };
}

/**
 * Changes the signed-in user's own password. The user id comes only from the
 * session, never from the request, so nobody can change someone else's password.
 */
export async function changeMyPassword(
  context: Context,
  currentPassword: string,
  newPassword: string,
) {
  const db = await getDb();
  const users = db.collection<UserDoc>("users");
  const user = await users.findOne({ id: context.userId });
  if (!user || !(await verifyPassword(currentPassword, user.password_hash)))
    throw new Error("Your current password is incorrect.");
  if (await verifyPassword(newPassword, user.password_hash))
    throw new Error("Choose a password different from your current one.");
  await users.updateOne(
    { id: user.id },
    {
      $set: {
        password_hash: await hashPassword(newPassword),
        password_changed_at: Math.floor(Date.now() / 1000),
      },
    },
  );
  // Other devices are signed out; this one gets a fresh session.
  setSessionCookie(signSession(user.id));
  await logActivity(user.id, "member.password_changed", "profile", user.id, user.email);
  return { ok: true };
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
  input: {
    email: string;
    password: string;
    full_name: string;
    role: AppRole;
    designation?: string;
    department?: string;
  },
) {
  // Admins and super admins may add members, but only a super admin may create a super admin.
  await requireRole(context, ADMINS);
  const db = await getDb();
  if (input.role === "Super_Admin" && !(await rolesOf(context.userId, db)).includes("Super_Admin"))
    throw new Error("Only a super admin can make someone a super admin.");
  const email = normEmail(input.email);
  if (await db.collection<UserDoc>("users").findOne({ email }))
    throw new Error("A user with this email already exists.");
  const id = randomUUID();
  const timestamp = now();
  await db.collection<UserDoc>("users").insertOne({
    id,
    email,
    password_hash: await hashPassword(input.password),
    active: true,
    created_at: timestamp,
  });
  const profile: ProfileDoc = {
    id,
    email,
    full_name: input.full_name,
    avatar_url: null,
    designation: input.designation ?? null,
    department: input.department ?? null,
    phone: null,
    joining_date: null,
    skills: null,
    availability: "available",
    created_at: timestamp,
    updated_at: timestamp,
  };
  await db.collection<ProfileDoc>("profiles").insertOne(profile);
  await db
    .collection<UserRoleDoc>("user_roles")
    .insertOne({ id: randomUUID(), user_id: id, role: input.role, created_at: timestamp });
  await logActivity(id, "member.joined", "profile", id, input.full_name || email);
  return { id };
}

// ---------- profiles / team ----------
export async function updateMyProfile(
  context: Context,
  changes: Partial<
    Pick<ProfileDoc, "full_name" | "designation" | "phone" | "joining_date" | "availability">
  >,
) {
  const db = await getDb();
  await db
    .collection<ProfileDoc>("profiles")
    .updateOne({ id: context.userId }, { $set: { ...changes, updated_at: now() } });
  return { id: context.userId };
}

// Directory fields only; email/phone stay private.
const directoryFields = {
  id: 1,
  full_name: 1,
  designation: 1,
  department: 1,
  availability: 1,
  avatar_url: 1,
  joining_date: 1,
  created_at: 1,
} as const;

export async function teamDirectory(context: Context) {
  const db = await getDb();
  const staff = await hasAnyRole(context.userId, STAFF);
  const rows = await db
    .collection<ProfileDoc>("profiles")
    .find({}, { projection: { _id: 0, ...directoryFields, ...(staff ? { email: 1 } : {}) } })
    .sort({ created_at: 1 })
    .toArray();
  return rows as Array<
    Partial<ProfileDoc> &
      Pick<
        ProfileDoc,
        "id" | "full_name" | "designation" | "department" | "availability" | "created_at"
      >
  >;
}

export async function teamWithWorkload(context: Context) {
  const db = await getDb();
  const [members, disabled] = await Promise.all([
    teamDirectory(context),
    db
      .collection<UserDoc>("users")
      .find({ active: false }, { projection: { id: 1 } })
      .toArray(),
  ]);
  // Disabled accounts stay in the list but are marked Non-Active on their card.
  const disabledIds = new Set(disabled.map((u) => u.id));
  // Roles are only sent to admins (they need them to decide who they may remove).
  const isAdmin = await hasAnyRole(context.userId, ADMINS);
  const roleRows = isAdmin ? await db.collection<UserRoleDoc>("user_roles").find({}).toArray() : [];
  return members.map((m) => ({
    ...m,
    active: !disabledIds.has(m.id),
    roles: isAdmin ? roleRows.filter((r) => r.user_id === m.id).map((r) => r.role) : undefined,
  }));
}

export async function getMember(context: Context, id: string) {
  const db = await getDb();
  const member = (await teamDirectory(context)).find((m) => m.id === id) ?? null;
  if (!member) return null;
  // Only a super admin edits member profiles here (members edit their own in Settings).
  const canEdit = await hasAnyRole(context.userId, ["Super_Admin"]);
  const canSeePhone = context.userId === id || (await hasAnyRole(context.userId, ADMINS));
  const canSeeTasks =
    context.userId === id || (await teamTaskOwners(context, db)).some((m) => m.id === id);
  const [tasks, projects, memberships, private_] = await Promise.all([
    canSeeTasks ? tasksOf(db, [id]) : [],
    listProjects(context),
    db.collection<ProjectMemberDoc>("project_members").find({ user_id: id }).toArray(),
    // Phone stays private: only the member themselves and admins receive it.
    canSeePhone
      ? db.collection<ProfileDoc>("profiles").findOne({ id }, { projection: { _id: 0, phone: 1 } })
      : null,
  ]);
  return {
    member: { ...member, phone: private_?.phone ?? null },
    canEdit,
    canSeeTasks,
    tasks,
    projects,
    memberships: memberships.map((m) => m.project_id),
  };
}

export async function updateMemberProfile(
  context: Context,
  id: string,
  changes: Partial<Pick<ProfileDoc, "full_name" | "designation" | "department" | "phone">>,
) {
  await requireRole(context, ["Super_Admin"]);
  const db = await getDb();
  const result = await db
    .collection<ProfileDoc>("profiles")
    .updateOne({ id }, { $set: { ...changes, updated_at: now() } });
  if (!result.matchedCount) throw new Error("Member not found.");
  return { id };
}

/**
 * Dashboard data, scoped by role:
 *  - everyone: their department's team, the projects they work on, their own tasks;
 *  - admins: also every project and team task in their department(s);
 *  - super admins: the same as admins, across both departments.
 */
export async function getDashboard(context: Context) {
  const db = await getDb();
  const me = context.userId;
  const [isAdmin, types, projects, memberships, people, disabled] = await Promise.all([
    hasAnyRole(me, ADMINS),
    projectTypesFor(context, db),
    listProjects(context),
    db.collection<ProjectMemberDoc>("project_members").find({ user_id: me }).toArray(),
    teamDirectory(context),
    db
      .collection<UserDoc>("users")
      .find({ active: false }, { projection: { _id: 0, id: 1 } })
      .toArray(),
  ]);

  const memberOf = new Set(memberships.map((m) => m.project_id));
  const mine = projects.filter((p) => memberOf.has(p.id) || p.lead_id === me);
  // Charts and "delayed": admins look at the whole department, everyone else at their own projects.
  const scope = isAdmin ? projects : mine;

  // Pending / completed counts: your own tasks, plus (admins) the tasks of the people you oversee.
  const owners = [me, ...(isAdmin ? (await teamTaskOwners(context, db)).map((m) => m.id) : [])];
  const [tasks, scopeTasks] = await Promise.all([
    db
      .collection<TaskDoc>("tasks")
      .find({ assigned_to: { $in: owners } }, { projection: { _id: 0, status: 1 } })
      .toArray(),
    db
      .collection<TaskDoc>("tasks")
      .find(
        { project_id: { $in: scope.map((p) => p.id) } },
        { projection: { _id: 0, status: 1, priority: 1 } },
      )
      .toArray(),
  ]);

  // Active accounts in your department(s); "Tech & SEO" people first.
  const inactive = new Set(disabled.map((u) => u.id));
  const team = people
    .filter((p) => !inactive.has(p.id) && inDepartments(types, p.department))
    .sort(
      (a, b) =>
        Number(b.department === "Tech & SEO") - Number(a.department === "Tech & SEO") ||
        (a.full_name ?? "").localeCompare(b.full_name ?? ""),
    )
    .map((p) => ({
      id: p.id,
      full_name: p.full_name,
      designation: p.designation,
      department: p.department,
      availability: p.availability,
    }));

  const summary = (p: ProjectDoc) => ({
    id: p.id,
    name: p.name,
    project_type: p.project_type,
    status: p.status,
    progress: p.progress,
    expected_delivery_date: p.expected_delivery_date,
  });
  return {
    isAdmin,
    projects: projects.map(summary),
    myProjects: mine.map((p) => ({ ...summary(p), isOwner: p.lead_id === me })),
    scopeProjects: scope.map(summary),
    tasks: tasks.map((t) => ({ status: t.status })),
    scopeTasks: scopeTasks.map((t) => ({ status: t.status, priority: t.priority })),
    team,
  };
}

// ---------- tasks (each person's daily work log) ----------
type TaskInput = Pick<
  TaskDoc,
  "task_date" | "project_id" | "name" | "priority" | "status" | "start_date" | "end_date" | "notes"
>;

/** Projects someone may log tasks against: admins any project, others the ones they work on. */
async function taskProjectIds(context: Context, db: Db): Promise<string[] | "all"> {
  if (await hasAnyRole(context.userId, ADMINS)) return "all";
  const [memberships, owned] = await Promise.all([
    db.collection<ProjectMemberDoc>("project_members").find({ user_id: context.userId }).toArray(),
    db
      .collection<ProjectDoc>("projects")
      .find({ lead_id: context.userId }, { projection: { _id: 0, id: 1 } })
      .toArray(),
  ]);
  return [...new Set([...memberships.map((m) => m.project_id), ...owned.map((p) => p.id)])];
}

export async function listTaskProjects(context: Context) {
  const db = await getDb();
  const allowed = await taskProjectIds(context, db);
  return (await db
    .collection<ProjectDoc>("projects")
    .find(
      {
        archived_at: null,
        ...projectTypeFilter(await projectTypesFor(context, db)),
        ...(allowed === "all" ? {} : { id: { $in: allowed } }),
      },
      { projection: { _id: 0, id: 1, name: 1 } },
    )
    .sort({ name: 1 })
    .toArray()) as Array<Pick<ProjectDoc, "id" | "name">>;
}

/** Other people whose tasks this user may see (admins only, by department). */
async function teamTaskOwners(context: Context, db: Db) {
  if (!(await hasAnyRole(context.userId, ADMINS))) return [];
  const people = (await db
    .collection<ProfileDoc>("profiles")
    .find({}, { projection: { _id: 0, id: 1, full_name: 1, designation: 1, department: 1 } })
    .sort({ full_name: 1 })
    .toArray()) as Array<Pick<ProfileDoc, "id" | "full_name" | "designation" | "department">>;
  const viewer = people.find((p) => p.id === context.userId);
  // Super admins oversee both departments. Admins see their own department only, never super admins.
  if (await hasAnyRole(context.userId, ["Super_Admin"]))
    return people.filter((p) => p.id !== context.userId);
  const supers = new Set(
    (
      await db
        .collection<UserRoleDoc>("user_roles")
        .find({ role: "Super_Admin" }, { projection: { _id: 0, user_id: 1 } })
        .toArray()
    ).map((r) => r.user_id),
  );
  return people.filter(
    (p) =>
      p.id !== context.userId &&
      !supers.has(p.id) &&
      canSeeTasksOf(viewer?.department, p.department),
  );
}

async function withProjectNames(db: Db, tasks: Array<WithId<TaskDoc>>) {
  const ids = [...new Set(tasks.map((t) => t.project_id).filter((x): x is string => !!x))];
  const names = new Map(
    (
      await db
        .collection<ProjectDoc>("projects")
        .find({ id: { $in: ids } }, { projection: { _id: 0, id: 1, name: 1 } })
        .toArray()
    ).map((p) => [p.id, p.name]),
  );
  return tasks.map((t) => ({
    ...clean(t),
    project_name: (t.project_id && names.get(t.project_id)) || null,
  }));
}

async function tasksOf(db: Db, ownerIds: string[]) {
  const tasks = await db
    .collection<TaskDoc>("tasks")
    .find({ assigned_to: { $in: ownerIds } })
    .sort({ task_date: -1, created_at: -1 })
    .toArray();
  return withProjectNames(db, tasks);
}

export async function listMyTasks(context: Context) {
  return tasksOf(await getDb(), [context.userId]);
}

export async function listTeamTasks(context: Context) {
  await requireRole(context, ADMINS);
  const db = await getDb();
  const members = await teamTaskOwners(context, db);
  return {
    members,
    tasks: await tasksOf(
      db,
      members.map((m) => m.id),
    ),
  };
}

async function checkTaskProject(context: Context, db: Db, projectId: string) {
  const allowed = await taskProjectIds(context, db);
  if (allowed !== "all" && !allowed.includes(projectId))
    throw new Error("You can only add tasks to projects you are working on.");
  if (
    !(await db.collection("projects").findOne({
      id: projectId,
      archived_at: null,
      ...projectTypeFilter(await projectTypesFor(context, db)),
    }))
  )
    throw new Error("Project not found.");
}

function checkTaskDates(start?: string | null, end?: string | null) {
  // Dates are YYYY-MM-DD, so plain string comparison orders them correctly.
  if (start && end && end < start) throw new Error("End date cannot be before the start date.");
}

/** Tasks are logged for today only. The browser sends its local date, so allow a day either way for time zones. */
function checkTaskIsToday(date: string) {
  const day = 24 * 60 * 60 * 1000;
  const diff = Math.abs(
    Date.parse(`${date}T00:00:00Z`) - Date.parse(now().slice(0, 10) + "T00:00:00Z"),
  );
  if (!(diff <= day)) throw new Error("Tasks can only be logged for today.");
}

// Everyone logs their own tasks; nobody adds tasks for someone else.
export async function createTask(context: Context, input: TaskInput & { project_id: string }) {
  const db = await getDb();
  await checkTaskProject(context, db, input.project_id);
  checkTaskIsToday(input.task_date);
  checkTaskDates(input.start_date, input.end_date);
  const timestamp = now();
  const task: TaskDoc = {
    id: randomUUID(),
    ...input,
    assigned_to: context.userId,
    created_by: context.userId,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await db.collection<TaskDoc>("tasks").insertOne(task);
  await logActivity(context.userId, "task.created", "task", task.id, task.name, {
    assigned_to: task.assigned_to,
    project_id: task.project_id,
  });
  return { id: task.id };
}

/** Only the person a task belongs to may change or delete it. */
async function ownTask(context: Context, db: Db, id: string) {
  const task = await db.collection<TaskDoc>("tasks").findOne({ id });
  if (!task) throw new Error("Task not found.");
  if (task.assigned_to !== context.userId)
    throw new Error("Only the person this task belongs to can change it.");
  return task;
}

export async function updateTask(context: Context, id: string, input: Partial<TaskInput>) {
  // The log date is fixed when the task is added.
  const { task_date: _date, ...changes } = input;
  const db = await getDb();
  const task = await ownTask(context, db, id);
  if (changes.project_id && changes.project_id !== task.project_id)
    await checkTaskProject(context, db, changes.project_id);
  checkTaskDates(
    changes.start_date !== undefined ? changes.start_date : task.start_date,
    changes.end_date !== undefined ? changes.end_date : task.end_date,
  );
  await db
    .collection<TaskDoc>("tasks")
    .updateOne({ id }, { $set: { ...changes, updated_at: now() } });
  if (changes.status && changes.status !== task.status) {
    await logActivity(
      context.userId,
      "task.status_changed",
      "task",
      id,
      changes.name ?? task.name,
      { from: task.status, to: changes.status },
    );
  }
  return { id };
}

export async function deleteTask(context: Context, id: string) {
  const db = await getDb();
  await ownTask(context, db, id);
  await db.collection<TaskDoc>("tasks").deleteOne({ id });
  await db
    .collection<DailyLogDoc>("daily_logs")
    .updateMany({ task_id: id }, { $set: { task_id: null } });
  return { id };
}

// ---------- logs / activity ----------
export async function listActivity(opts: { since?: string; limit?: number }) {
  const db = await getDb();
  const filter = opts.since ? { created_at: { $gte: opts.since } } : {};
  const rows = await db
    .collection<ActivityDoc>("activity_log")
    .find(filter)
    .sort({ created_at: -1 })
    .limit(opts.limit ?? 500)
    .toArray();
  return rows.map(clean);
}

export async function listApplicationLogs(
  context: Context,
  opts: { since?: string; limit?: number },
) {
  await requireRole(context);
  return listActivity(opts);
}

// ---------- remove an account ----------
export async function deleteUser(context: Context, targetId: string) {
  // Only a super admin may delete accounts. Admins cannot.
  await requireRole(context, ["Super_Admin"]);
  if (targetId === context.userId) throw new Error("You cannot delete your own account.");
  const db = await getDb();
  const target = await db.collection<UserDoc>("users").findOne({ id: targetId });
  if (!target) throw new Error("Account not found.");
  const [callerRoles, targetRoles] = await Promise.all([
    rolesOf(context.userId, db),
    rolesOf(targetId, db),
  ]);
  const callerIsSuper = callerRoles.includes("Super_Admin");
  if ((targetRoles.includes("Admin") || targetRoles.includes("Super_Admin")) && !callerIsSuper) {
    throw new Error("Only a super admin can delete an admin or super admin account.");
  }
  if (
    targetRoles.includes("Super_Admin") &&
    (await db.collection<UserRoleDoc>("user_roles").countDocuments({ role: "Super_Admin" })) <= 1
  ) {
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
    db.collection("projects").updateMany({ lead_id: targetId }, { $set: { lead_id: null } }),
    db.collection("activity_log").updateMany({ actor_id: targetId }, { $set: { actor_id: null } }),
  ]);
  await logActivity(context.userId, "member.removed", "profile", targetId, name);
  return { id: targetId };
}

// ---------- member management (everyone can view; admins and super admins can change) ----------
export async function listMembers(context: Context) {
  const db = await getDb();
  // Emails follow the team directory rule: staff only.
  const staff = await hasAnyRole(context.userId, STAFF);
  const [profiles, roles, users] = await Promise.all([
    db
      .collection<ProfileDoc>("profiles")
      .find({}, { projection: { _id: 0, ...directoryFields, ...(staff ? { email: 1 } : {}) } })
      .sort({ created_at: 1 })
      .toArray(),
    db.collection<UserRoleDoc>("user_roles").find({}).toArray(),
    db
      .collection<UserDoc>("users")
      .find({}, { projection: { _id: 0, id: 1, active: 1 } })
      .toArray(),
  ]);
  const disabled = new Set(users.filter((u) => u.active === false).map((u) => u.id));
  return profiles.map((p) => ({
    ...p,
    role: primaryRole(roles.filter((r) => r.user_id === p.id).map((r) => r.role)),
    active: !disabled.has(p.id),
  }));
}

/**
 * Shared checks before changing someone's account: admins and super admins only, never on
 * yourself, and only a super admin may touch a super admin's account.
 */
async function assertCanManage(context: Context, targetId: string) {
  await requireRole(context, ADMINS);
  if (targetId === context.userId) throw new Error("You cannot change your own account here.");
  await checkUsers([targetId]);
  const db = await getDb();
  const [callerRoles, targetRoles] = await Promise.all([
    rolesOf(context.userId, db),
    rolesOf(targetId, db),
  ]);
  const callerIsSuper = callerRoles.includes("Super_Admin");
  if (targetRoles.includes("Super_Admin") && !callerIsSuper)
    throw new Error("Only a super admin can change a super admin's account.");
  return { db, targetRoles, callerIsSuper };
}

// Every member has exactly one role; setting it replaces whatever they had before.
export async function setMemberRole(context: Context, userId: string, role: AppRole) {
  const { db, targetRoles, callerIsSuper } = await assertCanManage(context, userId);
  if (role === "Super_Admin" && !callerIsSuper)
    throw new Error("Only a super admin can make someone a super admin.");
  const roles = db.collection<UserRoleDoc>("user_roles");
  if (
    role !== "Super_Admin" &&
    targetRoles.includes("Super_Admin") &&
    (await roles.countDocuments({ role: "Super_Admin" })) <= 1
  ) {
    throw new Error("You cannot remove the last super admin.");
  }
  await roles.deleteMany({ user_id: userId });
  await roles.insertOne({ id: randomUUID(), user_id: userId, role, created_at: now() });
  const target = await db.collection<ProfileDoc>("profiles").findOne({ id: userId });
  await logActivity(
    context.userId,
    "role.assigned",
    "user_role",
    userId,
    target?.full_name ?? target?.email ?? null,
    { role },
  );
  return { userId, role };
}

export async function setMemberActive(context: Context, userId: string, active: boolean) {
  const { db } = await assertCanManage(context, userId);
  await db.collection<UserDoc>("users").updateOne({ id: userId }, { $set: { active } });
  const target = await db.collection<ProfileDoc>("profiles").findOne({ id: userId });
  await logActivity(
    context.userId,
    active ? "member.enabled" : "member.disabled",
    "profile",
    userId,
    target?.full_name ?? target?.email ?? null,
  );
  return { userId, active };
}
