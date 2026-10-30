// Moves existing tasks onto the daily task log shape:
//  - task_date is the day the task was created,
//  - old statuses map to the new ones (pending -> not_started, testing -> in_progress),
//  - the old due date becomes the end date, and the description moves into notes,
//  - phase links and hour estimates are removed (tasks are no longer tied to phases),
//  - tasks with no owner belong to whoever created them.
// Safe to run more than once.
// Usage: npm run db:migrate-tasks
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB in .env");
  process.exit(1);
}

const statusMap = { pending: "not_started", testing: "in_progress" };

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const tasks = client.db(dbName).collection("tasks");

  const dated = await tasks.updateMany({ task_date: { $exists: false } }, [
    { $set: { task_date: { $substrCP: ["$created_at", 0, 10] } } },
  ]);
  console.log(`task_date set: ${dated.modifiedCount}`);

  for (const [from, to] of Object.entries(statusMap)) {
    const { modifiedCount } = await tasks.updateMany({ status: from }, { $set: { status: to } });
    console.log(`${from} -> ${to}: ${modifiedCount}`);
  }

  const ended = await tasks.updateMany({ end_date: { $exists: false } }, [
    { $set: { end_date: { $ifNull: ["$due_date", null] }, start_date: null } },
  ]);
  console.log(`start/end dates set: ${ended.modifiedCount}`);

  const noted = await tasks.updateMany(
    { description: { $nin: [null, ""] }, notes: { $in: [null, ""] } },
    [{ $set: { notes: "$description" } }],
  );
  console.log(`description moved to notes: ${noted.modifiedCount}`);

  const owned = await tasks.updateMany({ assigned_to: null, created_by: { $ne: null } }, [
    { $set: { assigned_to: "$created_by" } },
  ]);
  console.log(`owner filled from creator: ${owned.modifiedCount}`);

  const cleaned = await tasks.updateMany(
    {
      $or: ["description", "due_date", "phase_id", "estimated_hours", "actual_hours"].map((f) => ({
        [f]: { $exists: true },
      })),
    },
    {
      $unset: {
        description: "",
        due_date: "",
        phase_id: "",
        estimated_hours: "",
        actual_hours: "",
      },
    },
  );
  console.log(`old fields removed: ${cleaned.modifiedCount}`);

  await tasks.createIndex({ assigned_to: 1, task_date: -1 });
  console.log("index ready: tasks { assigned_to, task_date }");
} catch (e) {
  console.error("Failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
