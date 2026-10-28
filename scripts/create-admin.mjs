// Creates a user with the Super_Admin role (use it once to bootstrap the first account).
// Usage: npm run db:create-admin -- you@example.com "StrongPassword" "Your Name"
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";

const [emailArg, password, fullName] = process.argv.slice(2);
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB in .env");
  process.exit(1);
}
if (!emailArg || !password || password.length < 6) {
  console.error('Usage: npm run db:create-admin -- <email> <password (6+ chars)> ["Full Name"]');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const salt = randomBytes(16);
const key = await promisify(scrypt)(password, salt, 64);
const password_hash = `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
const ts = new Date().toISOString();
const id = randomUUID();

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(dbName);
  if (await db.collection("users").findOne({ email }))
    throw new Error("A user with this email already exists.");
  await db.collection("users").insertOne({ id, email, password_hash, created_at: ts });
  await db.collection("profiles").insertOne({
    id,
    email,
    full_name: fullName || email.split("@")[0],
    avatar_url: null,
    designation: null,
    department: null,
    phone: null,
    joining_date: null,
    skills: null,
    availability: "available",
    created_at: ts,
    updated_at: ts,
  });
  await db
    .collection("user_roles")
    .insertOne({ id: randomUUID(), user_id: id, role: "Super_Admin", created_at: ts });
  console.log(`Super admin created: ${email}`);
} catch (e) {
  console.error("Failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
