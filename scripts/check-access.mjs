/**
 * Access check: does a signed-in founder actually get their own data?
 *
 * Two bugs got through to the point where a founder could not sign in at all,
 * and neither would have been caught by the unit tests or by the pages
 * returning 200. Both are database-level, so this checks the database path
 * directly rather than going through the UI:
 *
 *   1. the seeded auth user had no auth.identities row, so GoTrue answered
 *      every sign-in attempt with 500 "Database error querying schema". The
 *      symptom was a generic "incorrect" message on a correct password.
 *
 *   2. no migration ever GRANTed the API roles on the tables. Every read and
 *      write returned 403 permission denied, and the 42 RLS policies were
 *      never even consulted. The pages still rendered 200.
 *
 * Run after any change to the migrations or the seed:
 *
 *   npm run db:check-access
 *
 * Needs SUPABASE_DB_PASSWORD, or it skips the database checks and reports that
 * it could only do the auth half.
 */

import { readFile } from "node:fs/promises";
import { Client } from "pg";

const DEMO_EMAIL = "founder@qubators.test";
const DEMO_PASSWORD = "demo-password-123";

/** Tables the app expects a signed-in member to be able to read. */
const TENANT_TABLES = [
  "businesses",
  "business_members",
  "products",
  "customers",
  "orders",
  "order_items",
  "transactions",
];

async function loadEnv() {
  const text = await readFile(".env.local", "utf8");
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
}

const results = [];
function check(name, pass, detail = "") {
  results.push({ name, pass, detail });
  const mark = pass ? "pass" : "FAIL";
  console.log(`  [${mark}] ${name}${detail ? `  ${detail}` : ""}`);
}

async function signIn(url, key, email, password) {
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const b = await r.json().catch(() => ({}));
  return { status: r.status, token: b.access_token, msg: b.msg || b.error_code };
}

async function main() {
  await loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY in .env.local");
    process.exit(2);
  }

  console.log("auth\n");

  const good = await signIn(url, key, DEMO_EMAIL, DEMO_PASSWORD);
  check(
    "demo account signs in",
    good.status === 200 && !!good.token,
    good.status === 200 ? "" : `status ${good.status} ${good.msg ?? ""}`,
  );

  const bad = await signIn(url, key, DEMO_EMAIL, "definitely-not-the-password");
  check(
    "wrong password is rejected cleanly",
    bad.status === 400,
    `status ${bad.status}`,
  );
  check(
    "rejection is 400 not 500",
    bad.status !== 500,
    bad.status === 500 ? "database error, not a credential error" : "",
  );

  if (!good.token) {
    console.log("\ncannot continue without a session");
    process.exit(1);
  }

  const h = { apikey: key, Authorization: `Bearer ${good.token}` };
  console.log("\nreading data as the signed-in founder\n");

  for (const t of TENANT_TABLES) {
    const r = await fetch(`${url}/rest/v1/${t}?select=*`, { headers: h });
    const b = await r.json();
    const rows = Array.isArray(b) ? b.length : -1;
    check(
      `reads ${t}`,
      r.status === 200 && rows >= 0,
      r.status === 200 ? `${rows} rows` : `status ${r.status} ${JSON.stringify(b).slice(0, 60)}`,
    );
  }

  const anon = await fetch(`${url}/rest/v1/businesses?select=*`, {
    headers: { apikey: key },
  });
  const anonBody = await anon.json();
  check(
    "signed-out requests are refused",
    anon.status >= 400 && !Array.isArray(anonBody),
    `status ${anon.status}`,
  );

  if (process.env.SUPABASE_DB_PASSWORD) {
    console.log("\ntable grants\n");
    const ref = url.replace("https://", "").replace(".supabase.co", "");
    const db = new Client({
      connectionString: `postgresql://postgres:${process.env.SUPABASE_DB_PASSWORD}@db.${ref}.supabase.co:5432/postgres`,
      ssl: { rejectUnauthorized: false },
    });
    await db.connect();
    try {
      const { rows } = await db.query(`
        select t.table_name,
               has_table_privilege('authenticated', format('%I.%I', t.table_schema, t.table_name), 'SELECT') as can_select,
               has_table_privilege('authenticated', format('%I.%I', t.table_schema, t.table_name), 'INSERT') as can_insert,
               has_table_privilege('authenticated', format('%I.%I', t.table_schema, t.table_name), 'UPDATE') as can_update,
               has_table_privilege('authenticated', format('%I.%I', t.table_schema, t.table_name), 'DELETE') as can_delete
        from information_schema.tables t
        where t.table_schema = 'public'
        order by t.table_name
      `);
      const missing = rows.filter(
        (r) => !(r.can_select && r.can_insert && r.can_update && r.can_delete),
      );
      check(
        `all ${rows.length} public tables granted to authenticated`,
        missing.length === 0,
        missing.length ? `missing: ${missing.map((m) => m.table_name).join(", ")}` : "",
      );

      const ids = await db.query(
        `select
           (select count(*)::int from auth.identities i
              join auth.users u on u.id = i.user_id
             where u.email = $1) as identities`,
        [DEMO_EMAIL],
      );
      check(
        "demo user has an auth.identities row",
        ids.rows[0].identities > 0,
        `${ids.rows[0].identities} row(s)`,
      );

      const hash = await db.query(
        "select left(encrypted_password, 7) as prefix from auth.users where email = $1",
        [DEMO_EMAIL],
      );
      check(
        "password is bcrypt cost 10",
        hash.rows[0]?.prefix === "$2a$10$",
        hash.rows[0]?.prefix ?? "no user",
      );
    } finally {
      await db.end();
    }
  } else {
    console.log("\n(no SUPABASE_DB_PASSWORD, skipped the grant checks)");
  }

  const failed = results.filter((r) => !r.pass);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  );
  if (failed.length) {
    console.log("failed: " + failed.map((f) => f.name).join(", "));
    process.exit(1);
  }
  console.log("access is working");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
