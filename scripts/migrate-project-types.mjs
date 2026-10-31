// Moves existing projects onto the Tech / SEO workflows:
//  - every project without a type becomes a Tech project,
//  - old statuses are mapped onto the nearest Tech stage,
//  - the retired maintenance flag and maintainer fields are removed,
//  - phases lose their assignee and sub-phases (phases are now just name, dates, status, notes).
// Phase names, dates and status are left as they are. Safe to run more than once.
// Usage: npm run db:migrate-project-types
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB in .env");
  process.exit(1);
}

const statusMap = {
  planning: "requirement_analysis",
  requirement_gathering: "requirement_analysis",
  design: "ui_ux_design",
  development: "dev_implementation",
  api_integration: "dev_implementation",
  crm_integration: "dev_implementation",
  in_progress: "dev_implementation",
  testing: "testing_deployment",
  deployment: "testing_deployment",
  client_review: "testing_deployment",
  live: "complete_delivered",
  completed: "complete_delivered",
  maintenance: "complete_maintenance",
  cancelled: "on_hold",
};

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const projects = client.db(dbName).collection("projects");

  const typed = await projects.updateMany(
    { project_type: { $exists: false } },
    { $set: { project_type: "tech" } },
  );
  console.log(`project type set to Tech: ${typed.modifiedCount}`);

  // Completed projects that were marked as maintained go to "Complete & Maintenance".
  const maintained = await projects.updateMany(
    { status: { $in: ["completed", "live"] }, isMaintenable: true },
    { $set: { status: "complete_maintenance" } },
  );
  console.log(`completed + maintained -> complete_maintenance: ${maintained.modifiedCount}`);

  for (const [from, to] of Object.entries(statusMap)) {
    const { modifiedCount } = await projects.updateMany({ status: from }, { $set: { status: to } });
    if (modifiedCount) console.log(`${from} -> ${to}: ${modifiedCount}`);
  }

  const cleaned = await projects.updateMany(
    { $or: [{ isMaintenable: { $exists: true } }, { maintainer_id: { $exists: true } }] },
    { $unset: { isMaintenable: "", maintainer_id: "" } },
  );
  console.log(`maintenance fields removed: ${cleaned.modifiedCount}`);

  const unassigned = await client
    .db(dbName)
    .collection("project_phases")
    .updateMany(
      { $or: [{ assigned_to: { $exists: true } }, { sub_phases: { $exists: true } }] },
      { $unset: { assigned_to: "", sub_phases: "" } },
    );
  console.log(`phase assignees and sub-phases removed: ${unassigned.modifiedCount}`);
} catch (e) {
  console.error("Failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
