// Creates user accounts. Safe to run more than once: emails that already exist are skipped.
//
// Test team (development only — they all share a weak password):
//   npm run db:create-admin
//     Manager    sa@gmail.com  Project Manager  Tech & SEO  Super_Admin
//     Tech TL    at@gmail.com  Tech TL          Tech        Admin
//     SEO TL     st@gmail.com  SEO TL           SEO         Admin
//     Developer  d@gmail.com   Developer        Tech        Developer
//     SEO        s@gmail.com   SEO              SEO         SEO
//
// A single super admin with your own password (use this for production):
//   npm run db:create-admin -- you@example.com "StrongPassword" "Your Name"
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import { MongoClient } from "mongodb";

const TEST_PASSWORD = "123456";
const TEST_TEAM = [
  {
    full_name: "Manager",
    email: "sa@gmail.com",
    designation: "Project Manager",
    department: "Tech & SEO",
    role: "Super_Admin",
  },
  {
    full_name: "Tech TL",
    email: "at@gmail.com",
    designation: "Tech TL",
    department: "Tech",
    role: "Admin",
  },
  {
    full_name: "SEO TL",
    email: "st@gmail.com",
    designation: "SEO TL",
    department: "SEO",
    role: "Admin",
  },
  {
    full_name: "Developer",
    email: "d@gmail.com",
    designation: "Developer",
    department: "Tech",
    role: "Developer",
  },
  { full_name: "SEO", email: "s@gmail.com", designation: "SEO", department: "SEO", role: "SEO" },
].map((u) => ({ ...u, password: TEST_PASSWORD }));

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB;
if (!uri || !dbName) {
  console.error("Set MONGODB_URI and MONGODB_DB in .env");
  process.exit(1);
}

const [emailArg, passwordArg, nameArg] = process.argv.slice(2);
let accounts = TEST_TEAM;
if (emailArg) {
  if (!passwordArg || passwordArg.length < 6) {
    console.error('Usage: npm run db:create-admin -- <email> <password (6+ chars)> ["Full Name"]');
    process.exit(1);
  }
  accounts = [
    {
      email: emailArg,
      password: passwordArg,
      full_name: nameArg || emailArg.split("@")[0],
      designation: null,
      department: null,
      role: "Super_Admin",
    },
  ];
}

// Same format as the app's hashPassword (src/lib/auth.server.ts).
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await promisify(scrypt)(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
try {
  await client.connect();
  const db = client.db(dbName);
  for (const account of accounts) {
    const email = account.email.trim().toLowerCase();
    if (await db.collection("users").findOne({ email })) {
      console.log(`Skipped (already exists): ${email}`);
      continue;
    }
    const ts = new Date().toISOString();
    const id = randomUUID();
    await db.collection("users").insertOne({
      id,
      email,
      password_hash: await hashPassword(account.password),
      active: true,
      created_at: ts,
    });
    await db.collection("profiles").insertOne({
      id,
      email,
      full_name: account.full_name,
      avatar_url: null,
      designation: account.designation,
      department: account.department,
      phone: null,
      joining_date: null,
      skills: null,
      availability: "available",
      created_at: ts,
      updated_at: ts,
    });
    await db
      .collection("user_roles")
      .insertOne({ id: randomUUID(), user_id: id, role: account.role, created_at: ts });
    console.log(`Created ${account.role}: ${email} (${account.full_name})`);
  }
} catch (e) {
  console.error("Failed:", e?.message ?? e);
  process.exitCode = 1;
} finally {
  await client.close();
}
