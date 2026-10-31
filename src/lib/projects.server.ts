import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { ObjectId, type Db, type WithId } from "mongodb";
import type { z } from "zod";
import type { PhaseDoc, ProfileDoc, ProjectDoc, ProjectMemberDoc, TaskDoc } from "./types";
import { ONGOING_TASK_STATUSES } from "./types";
import {
  PROJECT_STATUS_LABEL,
  PROJECT_TYPE_LABEL,
  canWorkOn,
  defaultPhasesFor,
  projectTypeOf,
  statusesFor,
  visibleProjectTypes,
  type ProjectStatus,
  type ProjectType,
} from "./project-status";
import {
  ADMINS,
  hasAnyRole,
  logActivity,
  now,
  requireRole,
  checkUsers as checkUserIds,
  type Context,
} from "./access.server";
import type { projectFields, projectSchema, phaseSchema } from "./projects.functions";
import { getDb } from "./mongodb.server";

type ProjectInput = z.infer<typeof projectSchema>;
type ProjectChanges = Partial<z.infer<typeof projectFields>>;
type PhaseInput = z.infer<typeof phaseSchema>;
export type Project = ProjectDoc;
type Phase = PhaseDoc;
type Task = TaskDoc;
type Member = ProjectMemberDoc;

function plain<T extends { id: string }>(doc: WithId<T>): T {
  const { _id, ...fields } = doc;
  return { ...fields, id: doc.id || String(_id) } as unknown as T;
}

/** Project types this user may see, from their department ("Tech & SEO" sees both). */
export async function projectTypesFor(context: Context, db: Db): Promise<ProjectType[]> {
  const profile = await db
    .collection<ProfileDoc>("profiles")
    .findOne({ id: context.userId }, { projection: { _id: 0, department: 1 } });
  return visibleProjectTypes(
    profile?.department,
    await hasAnyRole(context.userId, ["Super_Admin"]),
  );
}

/** Mongo filter for projects of these types; projects saved before types existed are Tech. */
export const projectTypeFilter = (types: ProjectType[]) =>
  types.includes("tech")
    ? { $or: [{ project_type: { $in: types } }, { project_type: { $exists: false } }] }
    : { project_type: { $in: types } };

/** Finds a project the user may see. Other departments' projects are reported as not found. */
async function projectDoc(context: Context, db: Db, id: string) {
  // Documents keep their original UUID `id`; ObjectId-only documents from earlier versions are still found.
  const projects = db.collection<Project>("projects");
  let doc = await projects.findOne({ id, archived_at: null });
  if (!doc && /^[a-f\d]{24}$/i.test(id)) {
    doc = await projects.findOne({
      _id: new ObjectId(id),
      archived_at: null,
      id: { $exists: false },
    });
  }
  if (!doc || !(await projectTypesFor(context, db)).includes(projectTypeOf(doc)))
    throw new Error("Project not found.");
  return doc;
}

/** Admins, or members assigned to the project ("Currently Working On"). */
async function requireAdminOrMember(context: Context, db: Db, projectId: string) {
  if (await hasAnyRole(context.userId, ADMINS)) return;
  const member = await db
    .collection<Member>("project_members")
    .findOne({ project_id: projectId, user_id: context.userId });
  if (!member) throw new Error("You do not have permission to make this change.");
}

function checkStatus(type: ProjectType, status?: ProjectStatus) {
  if (status && !statusesFor(type).includes(status))
    throw new Error(
      `"${PROJECT_STATUS_LABEL[status]}" is not a ${PROJECT_TYPE_LABEL[type]} project status.`,
    );
}

/** Tech projects take Tech people, SEO projects take SEO people ("Tech & SEO" fits both). */
async function checkDepartments(db: Db, type: ProjectType, ids: Array<string | null | undefined>) {
  const selected = ids.filter((id): id is string => !!id);
  if (!selected.length) return;
  const profiles = await db
    .collection<ProfileDoc>("profiles")
    .find({ id: { $in: selected } }, { projection: { _id: 0, full_name: 1, department: 1 } })
    .toArray();
  const wrong = profiles.find((p) => !canWorkOn(type, p.department));
  if (wrong)
    throw new Error(
      `${wrong.full_name ?? "This member"} is not in the ${PROJECT_TYPE_LABEL[type]} department.`,
    );
}

/** Puts someone on the project's team ("Currently Working On"); does nothing if already there. */
async function ensureMember(db: Db, projectId: string, userId: string) {
  // A deterministic _id keeps repeated or concurrent adds to a single membership.
  if (
    await db
      .collection<Member>("project_members")
      .findOne({ project_id: projectId, user_id: userId })
  )
    return;
  await db.collection<Member & { _id: string }>("project_members").updateOne(
    { _id: `member:${projectId}:${userId}` },
    {
      $setOnInsert: { id: randomUUID(), project_id: projectId, user_id: userId, created_at: now() },
    },
    { upsert: true },
  );
}

// Deterministic _ids make repeated or concurrent seeding idempotent.
async function insertDefaultPhases(db: Db, projectId: string, type: ProjectType) {
  const timestamp = now();
  await db.collection<Phase & { _id: string }>("project_phases").bulkWrite(
    defaultPhasesFor(type).map((name, position) => ({
      updateOne: {
        filter: { _id: `default:${projectId}:${position}` },
        update: {
          $setOnInsert: {
            id: randomUUID(),
            project_id: projectId,
            name,
            position,
            completed: false,
            status: "not_started" as const,
            start_date: null,
            end_date: null,
            notes: null,
            created_at: timestamp,
            updated_at: timestamp,
          },
        },
        upsert: true,
      },
    })),
    { ordered: false },
  );
}

async function progress(db: Db, project: Project): Promise<Project> {
  const phases = await db
    .collection<Phase>("project_phases")
    .find({ project_id: project.id })
    .project<Pick<Phase, "completed">>({ completed: 1, _id: 0 })
    .toArray();
  return {
    ...project,
    project_type: projectTypeOf(project),
    progress: phases.length
      ? Math.round((phases.filter((p) => p.completed).length / phases.length) * 100)
      : project.progress,
  };
}

export async function listProjects(context: Context): Promise<Project[]> {
  const db = await getDb();
  const docs = await db
    .collection<Project>("projects")
    .find({ archived_at: null, ...projectTypeFilter(await projectTypesFor(context, db)) })
    .sort({ created_at: -1 })
    .toArray();
  return Promise.all(docs.map((doc) => progress(db, plain(doc))));
}

export async function getProject(context: Context, id: string): Promise<Project> {
  const db = await getDb();
  return progress(db, plain(await projectDoc(context, db, id)));
}

// Any signed-in user may create a project.
export async function createProject(context: Context, input: ProjectInput) {
  await checkUserIds([input.lead_id]);
  checkStatus(input.project_type, input.status);
  const db = await getDb();
  if (!(await projectTypesFor(context, db)).includes(input.project_type))
    throw new Error(
      `You can only create projects for your own department, not ${PROJECT_TYPE_LABEL[input.project_type]}.`,
    );
  await checkDepartments(db, input.project_type, [input.lead_id]);
  const timestamp = now();
  const project: Project = {
    id: randomUUID(),
    description: null,
    client_name: null,
    client_company: null,
    client_email: null,
    client_phone: null,
    start_date: null,
    expected_delivery_date: null,
    actual_delivery_date: null,
    notes: null,
    technology_stack: null,
    lead_id: null,
    status: statusesFor(input.project_type)[0],
    priority: "medium",
    ...input,
    progress: 0,
    created_by: context.userId,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  await db.collection<Project>("projects").insertOne({ ...project });
  await insertDefaultPhases(db, project.id, project.project_type);
  // Non-admin creators join as a member so they can keep editing the project they made.
  if (!(await hasAnyRole(context.userId, ADMINS))) {
    await db.collection<Member>("project_members").insertOne({
      id: randomUUID(),
      project_id: project.id,
      user_id: context.userId,
      created_at: timestamp,
    });
  }
  // The single-threaded owner is always on the team.
  if (project.lead_id) await ensureMember(db, project.id, project.lead_id);
  await logActivity(context.userId, "project.created", "project", project.id, project.name);
  return { id: project.id };
}

export async function updateProject(context: Context, id: string, changes: ProjectChanges) {
  await checkUserIds([changes.lead_id]);
  const db = await getDb();
  const doc = await projectDoc(context, db, id);
  await requireAdminOrMember(context, db, id);
  // Team members may edit the project, but only admins choose the single-threaded owner.
  if (changes.lead_id !== undefined) await requireRole(context, ADMINS);
  const type = projectTypeOf(doc);
  checkStatus(type, changes.status);
  await checkDepartments(db, type, [changes.lead_id]);
  await db
    .collection<Project>("projects")
    .updateOne({ _id: doc._id, archived_at: null }, { $set: { ...changes, updated_at: now() } });
  // The single-threaded owner is always on the team.
  if (changes.lead_id) await ensureMember(db, id, changes.lead_id);
  return { id };
}

export async function listProjectPhases(context: Context, projectId: string): Promise<Phase[]> {
  const db = await getDb();
  await projectDoc(context, db, projectId);
  return (
    await db
      .collection<Phase>("project_phases")
      .find({ project_id: projectId })
      .sort({ position: 1, created_at: 1 })
      .toArray()
  ).map(plain);
}

export async function createProjectPhase(context: Context, projectId: string, input: PhaseInput) {
  const db = await getDb();
  await projectDoc(context, db, projectId);
  await requireAdminOrMember(context, db, projectId);
  const last = await db
    .collection<Phase>("project_phases")
    .findOne({ project_id: projectId }, { sort: { position: -1 } });
  const timestamp = now();
  const phase: Phase = {
    id: randomUUID(),
    project_id: projectId,
    start_date: null,
    end_date: null,
    notes: null,
    status: "not_started",
    ...input,
    completed: input.status === "completed",
    position: (last?.position ?? -1) + 1,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await db.collection<Phase>("project_phases").insertOne(phase);
  return { id: phase.id };
}

export async function updateProjectPhase(
  context: Context,
  projectId: string,
  phaseId: string,
  changes: Partial<PhaseInput>,
) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(context, db, projectId);
  const phases = db.collection<Phase>("project_phases");
  const before = await phases.findOne({ id: phaseId, project_id: projectId });
  if (!before) throw new Error("Phase not found.");
  await phases.updateOne(
    { id: phaseId, project_id: projectId },
    {
      $set: {
        ...changes,
        ...(changes.status ? { completed: changes.status === "completed" } : {}),
        updated_at: now(),
      },
    },
  );
  return { id: phaseId };
}

export async function deleteProjectPhase(context: Context, projectId: string, phaseId: string) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(context, db, projectId);
  const result = await db
    .collection<Phase>("project_phases")
    .deleteOne({ id: phaseId, project_id: projectId });
  if (!result.deletedCount) throw new Error("Phase not found.");
  return { id: phaseId };
}

export async function seedProjectPhases(context: Context, projectId: string) {
  await requireRole(context);
  const db = await getDb();
  const doc = await projectDoc(context, db, projectId);
  await insertDefaultPhases(db, projectId, projectTypeOf(doc));
  return {
    count: await db.collection<Phase>("project_phases").countDocuments({ project_id: projectId }),
  };
}

export async function listOngoingTasks(context: Context, projectId: string): Promise<Task[]> {
  const db = await getDb();
  await projectDoc(context, db, projectId);
  return (
    await db
      .collection<Task>("tasks")
      .find({ project_id: projectId, status: { $in: [...ONGOING_TASK_STATUSES] } })
      .sort({ task_date: -1, created_at: -1 })
      .toArray()
  ).map(plain);
}

export async function listProjectMembers(context: Context, projectId: string): Promise<Member[]> {
  const db = await getDb();
  await projectDoc(context, db, projectId);
  return (
    await db.collection<Member>("project_members").find({ project_id: projectId }).toArray()
  ).map(plain);
}

// Admins and the project's own team members manage "Currently Working On".
export async function addProjectMember(context: Context, projectId: string, userId: string) {
  await checkUserIds([userId]);
  const db = await getDb();
  const doc = await projectDoc(context, db, projectId);
  await requireAdminOrMember(context, db, projectId);
  await checkDepartments(db, projectTypeOf(doc), [userId]);
  await ensureMember(db, projectId, userId);
  return { userId };
}

export async function removeProjectMember(context: Context, projectId: string, userId: string) {
  const db = await getDb();
  const doc = await projectDoc(context, db, projectId);
  await requireAdminOrMember(context, db, projectId);
  // The single-threaded owner stays on the team; change or clear the owner first.
  if (doc.lead_id === userId)
    throw new Error(
      "The single-threaded owner can't be removed from the team. Change or clear the owner first.",
    );
  await db
    .collection<Member>("project_members")
    .deleteMany({ project_id: projectId, user_id: userId });
  return { userId };
}
