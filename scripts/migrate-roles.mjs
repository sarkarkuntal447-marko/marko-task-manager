// Renames stored roles to the new names (super_admin -> Super_Admin, admin -> Admin,
// moderator -> SEO, developer -> Developer). Safe to run more than once.
// Usage: npm run db:migrate-roles
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB in .env");
  process.exit(1);
}

const renames = {
  super_admin: "Super_Admin",
  admin: "Admin",
  moderator: "SEO",
  developer: "Developer",
};

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const roles = client.db(dbName).collection("user_roles");
  for (const [from, to] of Object.entries(renames)) {
    const { modifiedCount } = await roles.updateMany({ role: from }, { $set: { role: to } });
    console.log(`${from} -> ${to}: ${modifiedCount} updated`);
  }
} catch (e) {
  console.error("Failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
