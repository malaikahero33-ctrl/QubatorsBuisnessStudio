/**
 * Read-only inspection of the live database.
 * Used to confirm what actually exists, without changing anything.
 */
import { Client } from "pg";

const password = process.argv[2];
if (!password) {
  console.error("usage: node scripts/inspect-db.mjs <password>");
  process.exit(1);
}

const client = new Client({
  connectionString:
    "postgresql://postgres:" +
    encodeURIComponent(password) +
    "@db.dptubikzfvhtmgjvptmt.supabase.co:5432/postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
});

const q = async (label, sql) => {
  try {
    const { rows } = await client.query(sql);
    console.log(`  ${label.padEnd(30)} ${rows[0].n}`);
  } catch (e) {
    console.log(`  ${label.padEnd(30)} ERROR ${e.message.slice(0, 60)}`);
  }
};

try {
  await client.connect();
  console.log("\nCONNECTED\n");
  await q("public tables", "select count(*)::int n from information_schema.tables where table_schema='public'");
  await q("functions", "select count(*)::int n from pg_proc p join pg_namespace x on x.oid=p.pronamespace where x.nspname='public'");
  await q("tables with RLS", "select count(*)::int n from pg_tables where schemaname='public' and rowsecurity");
  await q("rls policies", "select count(*)::int n from pg_policies where schemaname='public'");
  await q("grants to anon", "select count(*)::int n from information_schema.role_table_grants where grantee='anon'");
  await q("grants to authenticated", "select count(*)::int n from information_schema.role_table_grants where grantee='authenticated'");
  await q("auth users", "select count(*)::int n from auth.users");
  await q("businesses", "select count(*)::int n from public.businesses");
  await q("products", "select count(*)::int n from public.products");
  await q("customers", "select count(*)::int n from public.customers");
  await q("orders", "select count(*)::int n from public.orders");

  const { rows: biz } = await client.query(
    "select name, currency, stage from public.businesses order by created_at limit 3",
  );
  if (biz.length) {
    console.log("\n  businesses:");
    for (const b of biz) console.log(`    ${b.name} (${b.currency}, ${b.stage})`);
  }

  const { rows: users } = await client.query(
    "select email, email_confirmed_at is not null as confirmed from auth.users order by created_at limit 5",
  );
  if (users.length) {
    console.log("\n  auth users:");
    for (const u of users) {
      console.log(`    ${u.email}  confirmed=${u.confirmed}`);
    }
  }
  console.log("");
  await client.end();
} catch (e) {
  console.error(`\nFAILED: ${e.message}\n`);
  process.exit(1);
}
