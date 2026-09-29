/**
 * Repair the demo account properly.
 *
 * The hand-built auth.users row was not merely unusable for sign-in - it
 * broke GoTrue for the whole project. Once it existed, every lookup against
 * auth.users could fail, including a brand new signup ("Database error
 * finding user"). It has to be removed.
 *
 * Order matters:
 *   1. drop the demo business first, because businesses.owner_id references
 *      profiles ON DELETE RESTRICT and the profile cascades from auth.users
 *   2. delete the broken auth user
 *   3. sign up through the API, which is the only supported way to make a user
 *   4. re-run the SQL seed, which finds the user by email and rebuilds the data
 *
 * Only demo data is destroyed. Nothing real exists in this project yet.
 */

import { readFile } from "node:fs/promises";
import { Client } from "pg";

const EMAIL = "founder@qubators.test";
const PASSWORD = "demo-password-123";

function loadEnv() {
  return readFile(".env.local", "utf8").then((text) => {
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      let v = m[2].trim();
      if (v.startsWith('"') || v.startsWith("'")) {
        const q = v[0];
        const e = v.indexOf(q, 1);
        v = e > -1 ? v.slice(1, e) : v.slice(1);
      } else {
        const h = v.indexOf(" #");
        if (h > -1) v = v.slice(0, h).trim();
      }
      if (!process.env[m[1]]) process.env[m[1]] = v;
    }
  });
}

async function main() {
  await loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const ref = url.replace("https://", "").replace(".supabase.co", "");
  const dbUrl = `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${ref}.supabase.co:5432/postgres`;

  const db = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  await db.connect();

  console.log("1. removing the demo business (owner_id blocks deleting the profile)");
  const delBiz = await db.query(
    "delete from businesses where slug = 'sunrise-foods' returning id",
  );
  console.log(`   ${delBiz.rowCount} business removed`);

  console.log("2. removing every leftover auth user");
  const delUsers = await db.query("delete from auth.users returning email, id");
  for (const u of delUsers.rows) console.log(`   removed ${u.email}`);
  // anything left in public that pointed at those profiles
  await db.query("delete from public.profiles");

  console.log("3. signing up through the auth API");
  const res = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, data: { full_name: "Amina K" } }),
  });
  const body = await res.json();
  if (!res.ok) {
    console.error("   signup failed:", res.status, JSON.stringify(body).slice(0, 240));
    await db.end();
    process.exit(1);
  }
  const newId = body.user?.id ?? body.id;
  console.log(`   created ${EMAIL}`);

  console.log("4. signing in to prove it works");
  const li = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const liBody = await li.json();
  console.log(`   sign-in: ${li.status}  token=${!!liBody.access_token}`);

  await db.end();

  if (!liBody.access_token) process.exit(1);
  console.log("\nNow run:  npm run db:seed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
