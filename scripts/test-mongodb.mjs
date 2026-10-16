import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DB;
if (!uri || !databaseName) {
  console.error("Add MONGODB_URI and MONGODB_DB to the root .env file (see .env.example).");
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(databaseName);
  await db.command({ ping: 1 });
  // Verify that the configured database is accessible, not just the cluster.
  await db.listCollections({}, { nameOnly: true }).toArray();
  console.log(`MongoDB connection successful. Database: ${databaseName}`);
} catch (error) {
  console.error(`MongoDB connection failed (${error?.name ?? "Error"}).`);
  console.error("Check the Atlas database user, encoded password, cluster hostname, database permissions and IP access list.");
  process.exitCode = 1;
} finally {
  await client.close();
}
