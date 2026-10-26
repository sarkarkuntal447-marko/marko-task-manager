// Creates collection indexes. Safe to run repeatedly.
// Usage: npm run db:setup   (reads MONGODB_URI and MONGODB_DB from .env)
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB in .env");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(dbName);
  const idx = (c, spec, opts = {}) => db.collection(c).createIndex(spec, opts);
  await Promise.all([
    idx("users", { id: 1 }, { unique: true }),
    idx("users", { email: 1 }, { unique: true }),
    idx("profiles", { id: 1 }, { unique: true }),
    idx("user_roles", { id: 1 }, { unique: true }),
    idx("user_roles", { user_id: 1, role: 1 }, { unique: true }),
    idx("projects", { id: 1 }, { unique: true, sparse: true }),
    idx("projects", { archived_at: 1, created_at: -1 }),
    idx("project_phases", { project_id: 1, position: 1 }),
    idx("project_members", { project_id: 1, user_id: 1 }),
    idx("tasks", { id: 1 }, { unique: true }),
    idx("tasks", { assigned_to: 1 }),
    idx("tasks", { project_id: 1 }),
    idx("daily_logs", { user_id: 1, log_date: -1 }),
    idx("activity_log", { created_at: -1 }),
  ]);
  console.log(`Indexes ready in database "${dbName}".`);
} catch (e) {
  console.error("Setup failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
