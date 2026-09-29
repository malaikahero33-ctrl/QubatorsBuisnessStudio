/**
 * Apply database migrations directly to Postgres.
 *
 * Why this exists: the Supabase SQL Editor needed the SQL pasted by hand,
 * and the Supabase CLI needs an interactive terminal. This needs neither.
 *
 * Usage:
 *   node scripts/apply-migrations.mjs
 *   node scripts/apply-migrations.mjs --dry-run   # check connection only
 *
 * Reads the connection details from the environment (see .env.local):
 *   SUPABASE_DB_PASSWORD  the database password you set when creating the project
 *
 * Files are applied in filename order. Each runs in its own transaction, so a
 * failure rolls that file back cleanly and leaves earlier files applied.
 */

import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { Client } from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(here, "..");
const migrationsDir = join(projectRoot, "supabase", "migrations");
const seedFile = join(projectRoot, "supabase", "seed.sql");

/**
 * Ask for the password on the terminal.
 *
 * Only works when run interactively by a person - which is how you are
 * running it. Prompts are much easier than editing a file by hand.
 */
async function promptForPassword() {
  if (!process.stdin.isTTY) return null;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    return await new Promise((resolve) => rl.question("Database password: ", resolve));
  } finally {
    rl.close();
  }
}

// Load .env.local by hand so this script has no dotenv dependency.
async function loadEnvFile() {
  try {
    const text = await readFile(join(projectRoot, ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      const key = m[1];
      let value = m[2].trim();

      if (value.startsWith('"') || value.startsWith("'")) {
        // Quoted value: take everything up to the matching closing quote.
        // Anything after that quote is a comment, not part of the value.
        const quote = value[0];
        const end = value.indexOf(quote, 1);
        value = end > -1 ? value.slice(1, end) : value.slice(1);
      } else {
        // Unquoted: a trailing " #" starts a comment.
        const hash = value.indexOf(" #");
        if (hash > -1) value = value.slice(0, hash).trim();
      }

      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // No .env.local is fine; we only need the password.
  }
}

const GREEN = "\x1b[32m";
const RED = "\x1b[31m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const RESET = "\x1b[0m";

function buildConnectionString() {
  const url = process.env.SUPABASE_DB_URL;
  if (url) return url;

  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const password = process.env.SUPABASE_DB_PASSWORD;

  if (!projectUrl || !password) return null;

  const ref = projectUrl
    .replace("https://", "")
    .replace(".supabase.co", "");
  return `postgresql://postgres:${encodeURIComponent(password)}@db.${ref}.supabase.co:5432/postgres`;
}

async function main() {
  await loadEnvFile();

  const dryRun = process.argv.includes("--dry-run");
  const withSeed = process.argv.includes("--seed");

  // If no password is configured, ask for one. This removes the need to edit
  // any file by hand.
  if (!process.env.SUPABASE_DB_PASSWORD && !process.env.SUPABASE_DB_URL) {
    process.stdout.write(
      `\n  Set the Supabase database password (Settings -> Database in the\n` +
        `  dashboard) to something short, then type it here.\n\n`,
    );
    const typed = await promptForPassword();
    if (!typed) {
      console.error(
        `\n  No password given. Set SUPABASE_DB_PASSWORD in .env.local, or run\n` +
          `  this from a normal PowerShell window so it can ask you.\n`,
      );
      process.exit(1);
    }
    process.env.SUPABASE_DB_PASSWORD = typed.trim();
    console.log("");
  }

  const connString = buildConnectionString();

  if (!connString) {
    console.error(`
${RED}Cannot build a database connection.${RESET}

Add this line to ${BOLD}.env.local${RESET}:

  SUPABASE_DB_PASSWORD="your-database-password"

That is the password you set (or generated) when creating the Supabase
project. It is NOT the publishable key and NOT the service_role key.

Alternatively set the whole connection string:
  SUPABASE_DB_URL="postgresql://postgres:PASSWORD@db.YOUR-REF.supabase.co:5432/postgres"
`);
    process.exit(1);
  }

  const client = new Client({
    connectionString: connString,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 20_000,
  });

  console.log(`\n${DIM}Connecting…${RESET}`);
  try {
    await client.connect();
  } catch (err) {
    console.error(`\n${RED}Could not connect.${RESET}\n`);
    console.error(`  ${err.message}\n`);
    if (/password|authentication/i.test(err.message)) {
      console.error(
        `That usually means the database password is wrong. Check it in the\n` +
          `Supabase dashboard under Settings -> Database, or reset it there.\n`,
      );
    }
    process.exit(1);
  }

  console.log(`${GREEN}Connected.${RESET}`);

  if (dryRun) {
    const { rows } = await client.query("select version()");
    console.log(`\n${rows[0].version}\n`);
    await client.end();
    return;
  }

  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  // ---- migration tracking ------------------------------------------------
  // Without this, re-running fails on the first "relation already exists"
  // and the user cannot tell that the schema is in fact correct.
  await client.query(`
    create schema if not exists private;
    create table if not exists private.schema_migrations (
      filename    text primary key,
      applied_at  timestamptz not null default timezone('utc', now())
    );
  `);

  const { rows: appliedRows } = await client.query(
    "select filename from private.schema_migrations",
  );
  const alreadyApplied = new Set(appliedRows.map((r) => r.filename));

  // Reconcile: if tracking is empty but our tables already exist, the schema
  // was applied before this tracking table existed. Record it rather than
  // pretending it failed.
  if (alreadyApplied.size === 0) {
    const { rows: existing } = await client.query(`
      select count(*)::int as n
      from information_schema.tables
      where table_schema = 'public' and table_name = 'businesses'
    `);
    if (existing[0].n > 0) {
      console.log(
        `\n  ${DIM}Schema already present but untracked - recording it as applied.${RESET}\n`,
      );
      for (const file of files) {
        await client.query(
          "insert into private.schema_migrations (filename) values ($1) on conflict do nothing",
          [file],
        );
        alreadyApplied.add(file);
      }
    }
  }

  console.log(`\n${files.length} migration files found.\n`);

  let applied = 0;
  let skipped = 0;
  let failed = false;

  for (const file of files) {
    if (alreadyApplied.has(file)) {
      console.log(`  ${file.padEnd(42)} ${DIM}already applied${RESET}`);
      skipped += 1;
      continue;
    }

    const sql = await readFile(join(migrationsDir, file), "utf8");
    process.stdout.write(`  ${file.padEnd(42)} `);

    try {
      // Each migration is one transaction: a failure leaves no partial state.
      await client.query("begin");
      await client.query(sql);
      await client.query(
        "insert into private.schema_migrations (filename) values ($1)",
        [file],
      );
      await client.query("commit");
      console.log(`${GREEN}applied${RESET}`);
      applied += 1;
    } catch (err) {
      await client.query("rollback").catch(() => {});
      console.log(`${RED}FAILED${RESET}\n`);
      console.error(`\n${RED}${file}${RESET}\n  ${err.message}\n`);
      if (err.position) {
        console.error(`  character ${err.position}\n`);
      }
      failed = true;
      break;
    }
  }

  // Report what actually exists, rather than trusting the exit code.
  const { rows: tableRows } = await client.query(`
    select count(*)::int as n
    from information_schema.tables
    where table_schema = 'public'
  `);
  const { rows: fnRows } = await client.query(`
    select count(*)::int as n
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  `);
  const { rows: rlsRows } = await client.query(`
    select count(*)::int as n
    from pg_tables
    where schemaname = 'public' and rowsecurity
  `);
  const { rows: polRows } = await client.query(`
    select count(*)::int as n
    from pg_policies
    where schemaname = 'public'
  `);

  console.log(`\n${BOLD}Database now:${RESET}`);
  console.log(`  tables          ${tableRows[0].n}  ${DIM}(expected 21)${RESET}`);
  console.log(`  functions       ${fnRows[0].n}  ${DIM}(expected 7)${RESET}`);
  console.log(`  rls enabled     ${rlsRows[0].n}  ${DIM}(expected 21)${RESET}`);
  console.log(`  rls policies    ${polRows[0].n}`);

  if (!failed) {
    console.log(`\n${GREEN}${BOLD}All migrations applied.${RESET}`);

    if (withSeed) {
      const seedSql = await readFile(seedFile, "utf8");
      process.stdout.write(`\n  ${"seed.sql".padEnd(42)} `);
      try {
        await client.query("begin");
        await client.query(seedSql);
        await client.query("commit");
        console.log(`${GREEN}applied${RESET}`);

        const { rows: biz } = await client.query(
          "select count(*)::int as n from public.businesses",
        );
        const { rows: prod } = await client.query(
          "select count(*)::int as n from public.products",
        );
        const { rows: cust } = await client.query(
          "select count(*)::int as n from public.customers",
        );
        const { rows: ord } = await client.query(
          "select count(*)::int as n from public.orders",
        );
        console.log(
          `\n  demo data: ${biz[0].n} business, ${prod[0].n} products, ` +
            `${cust[0].n} customers, ${ord[0].n} orders`,
        );
        // Proves the GENERATED column and the recalculation trigger both work.
        const { rows: tot } = await client.query(
          "select coalesce(sum(total_minor),0)::bigint as n from public.orders",
        );
        console.log(
          `  order totals: ${tot[0].n} minor units ${DIM}(computed by trigger)${RESET}`,
        );
        console.log(`\n  sign in with  founder@qubators.test  /  demo-password-123`);
      } catch (err) {
        await client.query("rollback").catch(() => {});
        console.log(`${RED}FAILED${RESET}\n\n  ${err.message}\n`);
        console.error(
          `${DIM}  If this mentions auth.users permissions, create the user in the${RESET}\n` +
            `${DIM}  dashboard (Authentication -> Users -> Add user, tick Auto Confirm)${RESET}\n` +
            `${DIM}  and re-run with --seed. It will reuse the existing user.${RESET}\n`,
        );
        await client.end();
        process.exit(1);
      }
    } else {
      console.log(
        `\n${DIM}Optional: load demo data with  node scripts/apply-migrations.mjs --seed${RESET}\n`,
      );
    }
  } else {
    console.log(`\n${RED}Stopped. ${applied} applied, ${skipped} already present.${RESET}\n`);
  }

  await client.end();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${RED}Unexpected failure:${RESET} ${err.message}\n`);
  process.exit(1);
});
