# Marko Projects — MongoDB edition

The app now stores everything in MongoDB (Supabase has been removed).

## Setup

1. `cp .env.example .env` and fill in `MONGODB_URI`, `MONGODB_DB` and `JWT_SECRET`.
2. `npm install`
3. `npm run db:test` — checks the connection.
4. `npm run db:setup` — creates indexes.
5. `npm run db:create-admin` — creates the five test accounts (one per role and department, listed at the top of `scripts/create-admin.mjs`). For your own super admin instead, run `npm run db:create-admin -- you@example.com "Password" "Your Name"`.
6. `npm run dev`

## Deploy to Vercel

The production build uses Nitro's Vercel preset and runs as a Node.js server function.

1. Push the project to a Git provider and import the repository into Vercel.
2. Use `npm install` for the install command and `npm run build` for the build command. Leave the output directory unset so Vercel can use Nitro's generated deployment output.
3. In Vercel's **Project Settings → Environment Variables**, add these server-only variables for the environments you deploy:
   - `MONGODB_URI` — your MongoDB connection string.
   - `MONGODB_DB` — the database name, for example `marko`.
   - `JWT_SECRET` — a long, random secret of at least 32 characters. Generate a unique production value; do not reuse or commit the local `.env` value.
4. Ensure your MongoDB provider permits connections from Vercel. With MongoDB Atlas, Vercel's serverless functions do not have fixed outbound IPs on standard plans, so configure Atlas network access accordingly and use a strong, least-privilege database user.
5. Before using the app, connect to the production database and run `npm run db:setup` and `npm run db:create-admin -- you@example.com "Password" "Your Name"` from a trusted machine with the production MongoDB values in its local `.env`. Keep that file out of Git.

Redeploy after changing environment variables. Never add MongoDB credentials or `JWT_SECRET` as `VITE_*` variables; those are exposed to browser code.

## How it works

- **Auth:** email + password. Passwords are hashed with scrypt and stored in `users`. A signed session
  cookie (httpOnly, 7 days) is set on login; every server function checks it via `src/lib/auth-middleware.ts`.
- **Permissions:** the old Postgres row-level-security rules are enforced in `src/lib/app.server.ts` and
  `src/lib/projects.server.ts` (roles are read from the `user_roles` collection).
- **Collections:** `users`, `profiles`, `user_roles`, `projects`, `project_phases`, `project_members`,
  `tasks`, `daily_logs`, `activity_log`. Documents keep a UUID in `id`, so exported Supabase rows can be
  imported as-is. Activity entries (previously DB triggers) are written by the server code.
- Users created by an admin in **Settings** get an email, password and role; there is no public sign-up.
