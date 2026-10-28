import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import { ObjectId, type Db, type WithId } from "mongodb";
import type { z } from "zod";
import type { SubPhaseDoc, PhaseDoc, ProjectDoc, ProjectMemberDoc, TaskDoc } from "./types";
import {
  STAFF,
  logActivity,
  now,
  requireRole,
  checkUsers as checkUserIds,
  type Context,
} from "./access.server";
import type { projectSchema, phaseSchema, taskSchema } from "./projects.functions";
import { getDb } from "./mongodb.server";

type ProjectInput = z.infer<typeof projectSchema>;
type PhaseInput = z.infer<typeof phaseSchema>;
type TaskInput = z.infer<typeof taskSchema>;
export type Project = ProjectDoc;
type Phase = PhaseDoc;
type Task = TaskDoc;
type Member = ProjectMemberDoc;

function plain<T extends { id: string }>(doc: WithId<T>): T {
  const { _id, ...fields } = doc;
  return { ...fields, id: doc.id || String(_id) } as unknown as T;
}

async function projectDoc(db: Db, id: string) {
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
  if (!doc) throw new Error("Project not found.");
  return doc;
}

async function progress(db: Db, project: Project): Promise<Project> {
  const phases = await db
    .collection<Phase>("project_phases")
    .find({ project_id: project.id })
    .project<Pick<Phase, "completed">>({ completed: 1, _id: 0 })
    .toArray();
  return {
    ...project,
    // Projects created before this field existed have no value stored.
    isMaintenable: project.isMaintenable ?? false,
    progress: phases.length
      ? Math.round((phases.filter((p) => p.completed).length / phases.length) * 100)
      : project.progress,
  };
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDb();
  const docs = await db
    .collection<Project>("projects")
    .find({ archived_at: null })
    .sort({ created_at: -1 })
    .toArray();
  return Promise.all(docs.map((doc) => progress(db, plain(doc))));
}

export async function getProject(id: string): Promise<Project> {
  const db = await getDb();
  return progress(db, plain(await projectDoc(db, id)));
}

export async function createProject(context: Context, input: ProjectInput) {
  await requireRole(context);
  await checkUserIds([input.lead_id, input.maintainer_id]);
  const db = await getDb();
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
    maintainer_id: null,
    isMaintenable: false,
    status: "planning",
    priority: "medium",
    ...input,
    progress: 0,
    created_by: context.userId,
    created_at: timestamp,
    updated_at: timestamp,
    archived_at: null,
  };
  await db.collection<Project>("projects").insertOne({ ...project });
  await logActivity(context.userId, "project.created", "project", project.id, project.name);
  return { id: project.id };
}

export async function updateProject(context: Context, id: string, changes: Partial<ProjectInput>) {
  await requireRole(context);
  await checkUserIds([changes.lead_id, changes.maintainer_id]);
  const db = await getDb();
  const doc = await projectDoc(db, id);
  await db
    .collection<Project>("projects")
    .updateOne({ _id: doc._id, archived_at: null }, { $set: { ...changes, updated_at: now() } });
  return { id };
}

export async function archiveProject(context: Context, id: string) {
  await requireRole(context);
  const db = await getDb();
  const doc = await projectDoc(db, id);
  const timestamp = now();
  await db
    .collection<Project>("projects")
    .updateOne({ _id: doc._id }, { $set: { archived_at: timestamp, updated_at: timestamp } });
  return { id };
}

export async function listArchivedProjects(context: Context): Promise<Project[]> {
  await requireRole(context);
  const db = await getDb();
  const docs = await db
    .collection<Project>("projects")
    .find({ archived_at: { $ne: null } })
    .sort({ archived_at: -1 })
    .toArray();
  return docs.map(plain);
}

export async function restoreProject(context: Context, id: string) {
  await requireRole(context);
  const db = await getDb();
  const projects = db.collection<Project>("projects");
  let doc = await projects.findOne({ id, archived_at: { $ne: null } });
  if (!doc && /^[a-f\d]{24}$/i.test(id)) {
    doc = await projects.findOne({
      _id: new ObjectId(id),
      archived_at: { $ne: null },
      id: { $exists: false },
    });
  }
  if (!doc) throw new Error("Archived project not found.");
  await projects.updateOne({ _id: doc._id }, { $set: { archived_at: null, updated_at: now() } });
  await logActivity(context.userId, "project.restored", "project", plain(doc).id, doc.name);
  return { id };
}

export async function listProjectPhases(projectId: string): Promise<Phase[]> {
  const db = await getDb();
  await projectDoc(db, projectId);
  return (
    await db
      .collection<Phase>("project_phases")
      .find({ project_id: projectId })
      .sort({ position: 1, created_at: 1 })
      .toArray()
  ).map(plain);
}

export async function createProjectPhase(context: Context, projectId: string, input: PhaseInput) {
  await requireRole(context);
  await checkUserIds([input.assigned_to]);
  const db = await getDb();
  await projectDoc(db, projectId);
  const last = await db
    .collection<Phase>("project_phases")
    .findOne({ project_id: projectId }, { sort: { position: -1 } });
  const timestamp = now();
  const phase: Phase = {
    id: randomUUID(),
    project_id: projectId,
    assigned_to: null,
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
  await checkUserIds([changes.assigned_to]);
  const db = await getDb();
  await projectDoc(db, projectId);
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
  // Checking a parent checks all its sub-phases; un-checking a finished parent un-checks them.
  if (changes.status && before.sub_phases?.length) {
    const done = changes.status === "completed";
    if (done || before.completed) {
      await phases.updateOne(
        { id: phaseId, project_id: projectId },
        { $set: { "sub_phases.$[].completed": done } },
      );
    }
  }
  return { id: phaseId };
}

export async function deleteProjectPhase(context: Context, projectId: string, phaseId: string) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(db, projectId);
  const result = await db
    .collection<Phase>("project_phases")
    .deleteOne({ id: phaseId, project_id: projectId });
  if (!result.deletedCount) throw new Error("Phase not found.");
  return { id: phaseId };
}

export async function seedProjectPhases(context: Context, projectId: string) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(db, projectId);
  const phases = db.collection<Phase>("project_phases");
  const names = [
    "Requirement Gathering",
    "UI/UX Design",
    "Frontend Development",
    "Backend Development",
    "API Integration",
    "CRM Integration",
    "Database Setup",
    "Testing & QA",
    "Deployment",
    "Client Review",
    "Maintenance",
  ];
  const timestamp = now();
  // Deterministic _ids make repeated or concurrent seeding idempotent.
  await db.collection<Phase & { _id: string }>("project_phases").bulkWrite(
    names.map((name, position) => ({
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
            assigned_to: null,
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
  return { count: await phases.countDocuments({ project_id: projectId }) };
}

export async function listProjectTasks(projectId: string): Promise<Task[]> {
  const db = await getDb();
  await projectDoc(db, projectId);
  return (
    await db
      .collection<Task>("tasks")
      .find({ project_id: projectId })
      .sort({ created_at: -1 })
      .toArray()
  ).map(plain);
}

export async function createProjectTask(context: Context, projectId: string, input: TaskInput) {
  await requireRole(context, STAFF);
  await checkUserIds([input.assigned_to]);
  const db = await getDb();
  await projectDoc(db, projectId);
  if (
    !input.phase_id &&
    (await db.collection<Phase>("project_phases").countDocuments({ project_id: projectId })) > 0
  ) {
    throw new Error("Please select a phase for this project.");
  }
  if (
    input.phase_id &&
    !(await db
      .collection<Phase>("project_phases")
      .findOne({ id: input.phase_id, project_id: projectId }))
  ) {
    throw new Error("Phase not found in this project.");
  }
  const timestamp = now();
  const task: Task = {
    id: randomUUID(),
    project_id: projectId,
    description: null,
    assigned_to: null,
    phase_id: null,
    due_date: null,
    priority: "medium",
    status: "pending",
    estimated_hours: null,
    actual_hours: null,
    notes: null,
    ...input,
    created_by: context.userId,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await db.collection<Task>("tasks").insertOne(task);
  return { id: task.id };
}

export async function listProjectMembers(projectId: string): Promise<Member[]> {
  const db = await getDb();
  await projectDoc(db, projectId);
  return (
    await db.collection<Member>("project_members").find({ project_id: projectId }).toArray()
  ).map(plain);
}

export async function addProjectMember(context: Context, projectId: string, userId: string) {
  await requireRole(context);
  await checkUserIds([userId]);
  const db = await getDb();
  await projectDoc(db, projectId);
  if (
    await db
      .collection<Member>("project_members")
      .findOne({ project_id: projectId, user_id: userId })
  )
    return { userId };
  await db.collection<Member & { _id: string }>("project_members").updateOne(
    { _id: `member:${projectId}:${userId}` },
    {
      $setOnInsert: { id: randomUUID(), project_id: projectId, user_id: userId, created_at: now() },
    },
    { upsert: true },
  );
  return { userId };
}

export async function removeProjectMember(context: Context, projectId: string, userId: string) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(db, projectId);
  await db
    .collection<Member>("project_members")
    .deleteMany({ project_id: projectId, user_id: userId });
  return { userId };
}

// ---------- sub-phases (stored inside the parent phase document) ----------
// Keeps the parent in step with its children: all sub-phases done => parent done; otherwise not done.
async function syncParent(db: Db, projectId: string, phaseId: string) {
  const phases = db.collection<Phase>("project_phases");
  const phase = await phases.findOne({ id: phaseId, project_id: projectId });
  const subs = phase?.sub_phases ?? [];
  if (!phase || !subs.length) return;
  const all = subs.every((s) => s.completed);
  if (all && !phase.completed) {
    await phases.updateOne(
      { id: phaseId },
      { $set: { completed: true, status: "completed", updated_at: now() } },
    );
  } else if (!all && phase.completed) {
    await phases.updateOne(
      { id: phaseId },
      { $set: { completed: false, status: "in_progress", updated_at: now() } },
    );
  }
}

function checkDateRange(start?: string | null, end?: string | null) {
  // Dates are YYYY-MM-DD, so plain string comparison orders them correctly.
  if (start && end && end < start) throw new Error("End date cannot be before the start date.");
}

export async function addSubPhases(
  context: Context,
  projectId: string,
  phaseId: string,
  names: string[],
  dates: { start_date?: string | null; end_date?: string | null } = {},
) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(db, projectId);
  checkDateRange(dates.start_date, dates.end_date);
  const timestamp = now();
  const items: SubPhaseDoc[] = names.map((name) => ({
    id: randomUUID(),
    name,
    completed: false,
    created_at: timestamp,
    start_date: dates.start_date ?? null,
    end_date: dates.end_date ?? null,
  }));
  const result = await db
    .collection<Phase>("project_phases")
    .updateOne(
      { id: phaseId, project_id: projectId },
      { $push: { sub_phases: { $each: items } }, $set: { updated_at: timestamp } },
    );
  if (!result.matchedCount) throw new Error("Phase not found.");
  await syncParent(db, projectId, phaseId);
  return { count: items.length };
}

export async function updateSubPhase(
  context: Context,
  projectId: string,
  phaseId: string,
  subId: string,
  changes: {
    name?: string;
    completed?: boolean;
    start_date?: string | null;
    end_date?: string | null;
  },
) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(db, projectId);
  if (changes.start_date !== undefined || changes.end_date !== undefined) {
    const phase = await db
      .collection<Phase>("project_phases")
      .findOne({ id: phaseId, project_id: projectId });
    const sub = phase?.sub_phases?.find((s) => s.id === subId);
    if (!sub) throw new Error("Sub-phase not found.");
    checkDateRange(
      changes.start_date !== undefined ? changes.start_date : sub.start_date,
      changes.end_date !== undefined ? changes.end_date : sub.end_date,
    );
  }
  const set: Record<string, unknown> = { updated_at: now() };
  if (changes.name !== undefined) set["sub_phases.$.name"] = changes.name;
  if (changes.completed !== undefined) set["sub_phases.$.completed"] = changes.completed;
  if (changes.start_date !== undefined) set["sub_phases.$.start_date"] = changes.start_date;
  if (changes.end_date !== undefined) set["sub_phases.$.end_date"] = changes.end_date;
  const result = await db
    .collection<Phase>("project_phases")
    .updateOne({ id: phaseId, project_id: projectId, "sub_phases.id": subId }, { $set: set });
  if (!result.matchedCount) throw new Error("Sub-phase not found.");
  await syncParent(db, projectId, phaseId);
  return { id: subId };
}

export async function deleteSubPhase(
  context: Context,
  projectId: string,
  phaseId: string,
  subId: string,
) {
  await requireRole(context);
  const db = await getDb();
  await projectDoc(db, projectId);
  const result = await db
    .collection<Phase>("project_phases")
    .updateOne(
      { id: phaseId, project_id: projectId },
      { $pull: { sub_phases: { id: subId } }, $set: { updated_at: now() } },
    );
  if (!result.matchedCount) throw new Error("Phase not found.");
  await syncParent(db, projectId, phaseId);
  return { id: subId };
}
