// Resets the password for an existing user.
// Usage: node --env-file=.env scripts/reset-password.mjs <email> <newPassword>
import { randomBytes, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";

const [emailArg, newPassword] = process.argv.slice(2);
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;

if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB in .env");
  process.exit(1);
}

if (!emailArg || !newPassword || newPassword.length < 6) {
  console.error("Usage: node --env-file=.env scripts/reset-password.mjs <email> <newPassword (6+ chars)>");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const salt = randomBytes(16);
const key = await promisify(scrypt)(newPassword, salt, 64);
const password_hash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(dbName);
  const result = await db.collection("users").updateOne(
    { email },
    { $set: { password_hash } }
  );

  if (result.matchedCount === 0) {
    console.error(`No user found with email: ${email}`);
    process.exitCode = 1;
  } else {
    console.log(`Password successfully updated for: ${email}`);
  }
} catch (e) {
  console.error("Failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
