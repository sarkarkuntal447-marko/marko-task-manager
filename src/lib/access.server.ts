import "@tanstack/react-start/server-only";
import { randomUUID } from "node:crypto";
import type { Db } from "mongodb";
import { getDb } from "./mongodb.server";
import type { ActivityDoc, AppRole, ProfileDoc, UserRoleDoc } from "./types";

export type Context = { userId: string };
export const ADMINS: AppRole[] = ["admin", "super_admin"];
export const STAFF: AppRole[] = [...ADMINS, "moderator"];
export const now = () => new Date().toISOString();

export async function rolesOf(userId: string, db?: Db): Promise<AppRole[]> {
  const database = db ?? (await getDb());
  const rows = await database
    .collection<UserRoleDoc>("user_roles")
    .find({ user_id: userId })
    .toArray();
  return rows.map((r) => r.role);
}

export async function hasAnyRole(userId: string, allowed: AppRole[]) {
  return (await rolesOf(userId)).some((r) => allowed.includes(r));
}

export async function requireRole(context: Context, allowed: AppRole[] = ADMINS) {
  if (!(await hasAnyRole(context.userId, allowed))) {
    throw new Error("You do not have permission to make this change.");
  }
}

export async function checkUsers(ids: Array<string | null | undefined>) {
  const selected = [...new Set(ids.filter((id): id is string => !!id))];
  if (!selected.length) return;
  const db = await getDb();
  const found = await db
    .collection<ProfileDoc>("profiles")
    .countDocuments({ id: { $in: selected } });
  if (found !== selected.length) throw new Error("A selected team member could not be found.");
}

export async function logActivity(
  actorId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  entityName: string | null,
  metadata: Record<string, unknown> | null = null,
) {
  const db = await getDb();
  const actor = actorId
    ? await db
        .collection<ProfileDoc>("profiles")
        .findOne({ id: actorId }, { projection: { full_name: 1 } })
    : null;
  const entry: ActivityDoc = {
    id: randomUUID(),
    actor_id: actorId,
    actor_name: actor?.full_name ?? null,
    action,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    metadata,
    created_at: now(),
  };
  await db.collection<ActivityDoc>("activity_log").insertOne(entry);
}

/** Strip Mongo's internal _id so documents are safe to send to the browser. */
export function clean<T extends object>(doc: T): Omit<T, "_id"> {
  const { _id, ...rest } = doc as T & { _id?: unknown };
  return rest;
}
