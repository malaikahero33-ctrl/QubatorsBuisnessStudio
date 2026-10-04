# =============================================================================
# DEPLOY.md
#
# Getting this live. Ordered by what breaks first, not by what is interesting.
#
# Time estimate for a first deploy: about 30 minutes, most of it waiting.
# =============================================================================

## What is already true

- Builds clean, typecheck clean, 134 tests pass
- Production bundle works — 22 routes, no dev-only code paths
- Database is live with 21 tables and demo data
- Sign-in works against the real database

## What must happen before it is safe to show anyone

Three things, in this order. Skipping the first two is how a deploy ends up
looking fine while silently losing data.

### 1. Apply migration 0005 — REQUIRED

```
npm run db:push
```

It asks for your Supabase database password. **This is not your login
password** — it is in Supabase under Settings → Database.

Why it matters: migration 0005 adds the missing INSERT policies on
`notifications` and `ai_usage`. Without it, every new-order notification
fails silently and the AI daily cap counts zero forever. The app still looks
fine. That is the problem.

### 2. Rotate the database password

The database password was shared in chat and appears in this repository's
discussion history. **Set a new one in Supabase → Settings → Database before
going public.** Then update `SUPABASE_DB_PASSWORD` in your local `.env.local`.

### 3. Set the AI key

```
C:\dev\QubatorsBuisnessStudio\key.cmd
```

---

## Deploying to Netlify

Netlify works well for this app and has a generous free tier.

### Step 1 — the repository

The code is already pushed. `main` is up to date at
`github.com/malaikahero33-ctrl/QubatorsBuisnessStudio`.

### Step 2 — create the site

1. Go to **app.netlify.com/drop** or **app.netlify.com** → **Add new site** →
   **Import an existing project**
2. Connect GitHub and choose `QubatorsBuisnessStudio`

Build settings Netlify needs, because it does not detect Next.js 16
automatically:

| Setting | Value |
|---|---|
| Build command | `npm run build` |
| Publish directory | `.next` |
| Node version | **24** — set this in the Netlify UI, not just package.json |

For a Node 24 build, add a `.nvmrc` containing `24` and a `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "24"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

Node 20 will fail: Supabase's client requires 22 or above (ADR-10).

### Step 3 — environment variables

**Site configuration → Environment variables**. Add for **all scopes**:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dptubikzfvhtmgjvptmt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_...` |
| `AI_PROVIDER` | `groq` |
| `AI_API_KEY` | `gsk_...` |
| `AI_MODEL_FAST` | `llama-3.1-8b-instant` |
| `AI_MODEL_QUALITY` | `llama-3.3-70b-versatile` |
| `NEXT_PUBLIC_APP_URL` | `https://<your-site>.netlify.app` |

Do **not** add `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_PASSWORD`.

### Step 4 — rebuild

Trigger a fresh deploy after adding variables. Netlify, like Vercel, bakes
variables in at build time.

### Step 5 — set the domain in Supabase — REQUIRED

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://<your-site>.netlify.app`
- **Redirect URLs**:
  ```
  https://<your-site>.netlify.app/auth/callback
  https://<your-site>.netlify.app/auth/reset-password
  https://<your-site>.netlify.app/**
  ```

Until this is done, confirmation and password-reset emails redirect to
localhost and those features are broken while appearing to work.

### Netlify gotcha

If builds fail with "Cannot find module" or a Node version error, the Node
version is the cause. Netlify defaults to an old Node regardless of what
`package.json` says unless `NODE_VERSION` is set in `netlify.toml`.

### Rollback

**Deploys → pick the earlier build → Publish deploy.** No rebuild needed.

---

## Deploying to Vercel

Vercel is also fine and detects Next.js automatically, so it needs fewer
build settings than Netlify. Everything else is identical: same environment
variables, same Supabase redirect URL step, same verification order below.

### Step 1 — push the code

```
git push origin main
```

### Step 2 — import the repository

1. Go to **vercel.com/new**
2. Import `malaikahero33-ctrl/QubatorsBuisnessStudio`
3. Framework: **Next.js** (detected automatically)
4. Click Deploy

It will probably succeed on the first try but with **no environment
variables**, so the app will show the `/setup` page. That is expected.

### Step 3 — add environment variables

In the Vercel project: **Settings → Environment Variables → Add**. Add these
for **all three environments** (Production, Preview, Development):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://dptubikzfvhtmgjvptmt.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your publishable key, `sb_publishable_...` |
| `AI_PROVIDER` | `groq` |
| `AI_API_KEY` | your Groq key, `gsk_...` |
| `AI_MODEL_FAST` | `llama-3.1-8b-instant` |
| `AI_MODEL_QUALITY` | `llama-3.3-70b-versatile` |
| `NEXT_PUBLIC_APP_URL` | your Vercel domain, added after the first deploy |

**Never add** `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_DB_PASSWORD`. The app
does not need them at runtime, and a Vercel environment variable is not a
place to keep a database password.

### Step 4 — redeploy

Settings → Environment Variables → save, then **Deployments → ⋯ → Redeploy**.

Vercel does not pick up new environment variables on an existing build.

### Step 5 — tell Supabase your domain

This is the step everyone forgets, and password reset stays broken without it.

Supabase → **Authentication → URL Configuration**:

- **Site URL**: `https://your-app.vercel.app`
- **Redirect URLs**: add all of
  ```
  https://your-app.vercel.app/auth/callback
  https://your-app.vercel.app/auth/reset-password
  https://your-app.vercel.app/**
  ```

Without the Site URL set, Supabase redirects to localhost and every
confirmation and reset email leads nowhere.

### Step 6 — verify, in this order

Do these in order. Each depends on the one before.

1. Open your domain → you land on `/login`
2. Sign in as `founder@qubators.test` → dashboard shows revenue 60,000,000
3. Open **Orders** → the two seeded orders are listed
4. Open **Finance** → the ledger totals match the dashboard
5. Create a product → it appears in the list
6. Create an order → check the total equals what you entered
7. Open **Notifications** → the page loads (it may be empty)
8. Open **Copilot** → asks for a key or answers
9. Sign out, click **Forgot password** → you get the "check your email" screen

If step 9 bounces to localhost, go back to step 5.

---

## Deploying to your own server instead

If you need a Uganda-based host, any Node host works:

```bash
npm ci
npm run build
npm run start        # serves on $PORT, defaults to 3000
```

Put Nginx or Caddy in front for TLS. You must then:

- set `NEXT_PUBLIC_APP_URL` to your real domain
- complete Supabase step 5 above
- keep `AI_API_KEY` in the server's environment, not in a committed file

**Requirements**: Node 24 or newer. Not Node 20 — Supabase's client requires 22
or above (ADR-10).

---

## What is deliberately not configured yet

| Thing | Why | Where |
|---|---|---|
| Email sending | No provider chosen | DECISIONS.md question 3 |
| Custom domain | Needs a domain you own | — |
| Error monitoring | Would need a Sentry key | — |
| Analytics | Not needed yet | — |

None of these block a deploy. The app is fully usable without them.

---

## Rolling back

Vercel: **Deployments → ⋯ → Promote to Production** on the previous
deployment. Takes about ten seconds and needs no rebuild.

The database is not rolled back with it. Migrations are additive here — 0005
only adds policies — so an older build against a newer schema is fine.

---

## If something breaks

**`/setup` page appears** — environment variables are missing or misspelled.
Check the variable names character by character; `NEXT_PUBLIC_` prefix
required.

**Sign-in says "incorrect"** — either the variables are missing, or migration
0004 (`grants.sql`) was never applied. Run `npm run db:push`.

**Notifications never appear** — migration 0005 was not applied. Notifications
and `ai_usage` both need it.

**AI says the key was rejected** — the key is from a different provider than
`AI_PROVIDER`. Groq keys start `gsk_`, OpenAI keys start `sk-`.

**Password reset links go to localhost** — Supabase step 5 not done.