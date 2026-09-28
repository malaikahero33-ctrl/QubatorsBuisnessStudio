# Where we stopped — 29 September 2026

Everything below is committed and pushed. Nothing is in progress or half-finished.
Resume by running one command.

---

## Status

| | |
|---|---|
| App runs | ✅ http://localhost:3000 |
| Authentication | ✅ working against the live Supabase project |
| Code | ✅ 11 commits, synced to GitHub |
| Database schema | ⬜ **not yet created** — the only thing left |

**A user can sign up and sign in today.** The dashboard shows nothing because the
21 tables do not exist yet.

---

## To finish: one command

Set a short database password in Supabase first:

**Project → Settings → Database → set password to something you can type, e.g. `qubators2026`**

Then in PowerShell:

```powershell
cd C:\dev\QubatorsBuisnessStudio
npm.cmd run db:seed
```

It asks for the password. Type it. That applies all three migrations, then the
demo data, and prints the resulting table counts.

If it fails, the output names the exact file and error. Paste that back.

---

## Why a script instead of the SQL editor

The Supabase SQL Editor needed the SQL pasted by hand, and pasting does not work
in this environment. The Supabase CLI needs an interactive terminal. So
`scripts/apply-migrations.mjs` connects to Postgres directly with `pg`:

- prompts for the password, so no file needs editing by hand
- each migration runs in its own transaction, so a failure rolls back cleanly
  rather than leaving half a schema
- prints real table, function and RLS policy counts instead of trusting the
  exit code
- `--dry-run` tests the connection only
- `--seed` loads demo data

It has been verified as far as authentication: the connection string builds
correctly and reaches `password authentication failed for user postgres`, so the
host and username are right. **It has not yet run against a live database.**

---

## Connection details

Configured in `.env.local` (git-ignored, never committed):

```
NEXT_PUBLIC_SUPABASE_URL="https://dptubikzfvhtmgjvptmt.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_…"
```

The publishable key was verified: `/auth/v1/health` returns `200`. It is designed
to be public — it ships in browser code and row-level security is what protects
the data.

**Still needed:** `SUPABASE_DB_PASSWORD` — only for the migration script, never
by the running app.

---

## Sign in once seeded

```
founder@qubators.test  /  demo-password-123
```

If seeding fails on `auth.users` permissions, create that user in the dashboard
(Authentication → Users → Add user, tick **Auto Confirm User**) and re-run. The
seed finds the existing user and skips the insert.

---

## The open questions from DECISIONS.md

Still genuinely undecided, and none of them block the database:

1. LLM provider and monthly budget ceiling — blocks Phase 3
2. Whether the licence is MIT (a placeholder file exists, flagged as unconfirmed)
3. Whether registration is open at launch or invite-only
4. Free-tier limits: AI calls per month, businesses per user

---

## Note on the short database password

A simple password is acceptable for local development only. Change it before any
public deployment.

---

## Next build step

**Business creation** — the second item in the PRD's MVP acceptance criteria, and
the only thing standing between a new account and an empty dashboard.
