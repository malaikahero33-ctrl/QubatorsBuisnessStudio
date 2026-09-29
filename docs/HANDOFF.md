# Where we stopped — 29 September 2026

**Sign-in works and the dashboard shows real data.** Both were verified by actually
signing in and loading the page, not by reading the code.

---

## Sign in

```
http://localhost:3000

founder@qubators.test  /  demo-password-123
```

The dashboard shows Sunrise Foods in Kampala: USh 60,000,000 revenue, USh 3,150,000
spent, USh 56,850,000 profit, 3 products, 4 customers and 2 orders. All of it is read
live from Postgres through row-level security.

---

## To run it yourself

```powershell
cd C:\dev\QubatorsBuisnessStudio
npm.cmd run build
npm.cmd start
```

Then open http://localhost:3000.

Use `npm.cmd`, not `npm`. PowerShell's execution policy blocks `npm.ps1`, which is
what the bare `npm` resolves to. If you would rather not type `.cmd` every time, run
this once:

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

Use production mode (`build` then `start`) for real work. `npm run dev` recompiles on
first load and takes 10–60 seconds per cold route on this machine.

---

## Status

| | |
|---|---|
| App runs | ✅ http://localhost:3000 |
| Sign in | ✅ verified in a real browser |
| Dashboard | ✅ renders live data |
| Database | ✅ 21 tables, 42 RLS policies, 39 functions, live |
| Access check | ✅ 14/14 (`npm.cmd run db:check-access`) |
| Unit tests | ✅ 36 (`npm.cmd test`) |
| Business creation | ✅ `/business/new` |
| Not built yet | products, customers, orders, finance, AI |

---

## Two bugs that stopped sign-in, and what fixed them

Both were in the database rather than the app, and both had the same shape: a correct
password reported as "incorrect". Worth knowing because neither would have been caught
by a green build or a page that returns 200.

**1. The tables were never granted to the API roles.** Migrations created 21 tables and
42 RLS policies but no `GRANT`. Postgres answered every read with
`403 permission denied for table businesses`. Row-level security is checked *after* table
privileges, so none of the 42 policies were ever consulted — the tenant isolation was
completely inert while appearing to be configured.

Fixed by `supabase/migrations/20260928000004_grants.sql`, which also sets
`ALTER DEFAULT PRIVILEGES` so this cannot silently come back with the next migration.

**2. The demo user was created with SQL and was unusable.** Supabase stores a login in
two tables, and the seed wrote only one. It also hashed the password at bcrypt cost 6
where GoTrue expects 10. The result was `500 "Database error querying schema"` for every
sign-in attempt, right password or wrong. Worse, that one broken row made *every* user
lookup fail, including brand-new signups.

Fixed by creating the account through Supabase's own API — see ADR-13.

Both are written up in `docs/DECISIONS.md` as ADR-14 and ADR-13.

---

## Checking access later

```powershell
cd C:\dev\QubatorsBuisnessStudio
$env:SUPABASE_DB_PASSWORD = "<your database password>"
npm.cmd run db:check-access
```

Signs in as the demo user, reads every tenant table, confirms a signed-out request is
refused, and checks the grants. Set `SUPABASE_DB_PASSWORD` in the same PowerShell
session, or the grant checks are skipped and it says so.

---

## If sign-in ever breaks again

The error the app shows is not necessarily the cause. Read the actual response:

```powershell
# wrong password should be a clean 400, not a 500
Invoke-RestMethod -Uri "https://dptubikzfvhtmgjvptmt.supabase.co/auth/v1/token?grant_type=password" `
  -Method Post -Headers @{ apikey = "<key from .env.local>"; "Content-Type" = "application/json" } `
  -Body '{"email":"founder@qubators.test","password":"demo-password-123"}'
```

A `500 Database error querying schema` means the database is broken, not the password.
A `400 Invalid login credentials` means the password really is wrong.

---

## If the demo account is lost

```powershell
npm.cmd run db:repair-demo-user
```

Deletes the demo business and every leftover user, signs up a fresh account through the
API, and then re-run `npm.cmd run db:seed` to rebuild the data around it. Only demo
data is destroyed.

---

## Two things to do before this goes anywhere public

1. **Rotate the database password.** It is in this conversation's history.
2. **Turn "Confirm email" back on** in Supabase → Authentication → Providers. It is
   currently off so that signups work without a working mail sender. With it off,
   anybody can sign in as an unverified address.

---

## The open questions from DECISIONS.md

None of these block building. All of them are yours to decide.

1. LLM provider and monthly budget ceiling — blocks the AI features
2. Whether the licence is MIT (a placeholder exists, flagged as unconfirmed)
3. Whether registration is open at launch or invite-only
4. Free-tier limits: AI calls per month, businesses per user

---

## Next build step

**Products and customers** — the two lists a founder touches daily, and the first place
the AI has to write something the user then edits. The database tables and RLS policies
are already live, so this is pages and server actions against tables that exist.
