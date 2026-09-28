# Architecture — Qubators Business Studio

How the system is put together, and why. Follows PRD section 12.

Related: [DATABASE.md](./DATABASE.md) · [API.md](./API.md) · [DECISIONS.md](./DECISIONS.md)

---

## 1. Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16** (App Router) | PRD-mandated. Gives SSR, API routes and deployment in one unit — no separate backend to host or secure. Scaffolded on 16.3.6; see [ADR-9](./DECISIONS.md#adr-9-nextjs-16-and-no-webfonts). |
| Language | **TypeScript** (strict) | The domain is money, dates and AI output. Types are the cheapest guard. |
| Styling | **Tailwind CSS** | PRD-mandated. |
| Database | **PostgreSQL** via **Supabase** | PRD-mandated. Gives Postgres *and* Auth *and* Storage *and* RLS from one vendor. |
| Auth | **Supabase Auth** | Email verification and password reset built in — both are MVP acceptance criteria. |
| AI | **Provider-agnostic adapter** | See [DECISIONS.md](./DECISIONS.md#adr-3-ai-provider). |
| Email | **ZeptoMail** | PRD-mandated. |
| Hosting | **Vercel** | PRD-mandated. Zero-config for Next.js. |
| Repository | **GitHub** | Already connected. |

---

## 2. Request flow

```
Browser
  │
  │  1. Server Component fetches directly from Supabase
  │     (RLS applies — the browser never sees the service key)
  │
  ▼
Next.js  ──────────────►  Supabase  (Postgres + Auth + Storage)
  │
  │  2. Route Handlers for writes and AI
  │
  ├──►  lib/ai/*        ──►  LLM provider API
  ├──►  lib/email/*     ──►  ZeptoMail API
  └──►  Supabase        ──►  Postgres
```

**The rule that shapes everything: `SUPABASE_SERVICE_ROLE_KEY` never reaches the browser
and never appears in a `NEXT_PUBLIC_*` variable.** The browser uses the anon key, and RLS
decides what it can see. The service key is used only in server-side code, and as rarely
as possible.

---

## 3. Why Server Components for reads

The PRD has a rich dashboard and analytics views. Fetching them client-side would mean
shipping the service key or writing a route handler per view. With Server Components:

- data is fetched on the server, RLS enforced at the database
- the anon key stays in the browser; the secret does not
- the first HTML already contains the data → helps the 3-second target (PRD section 16)
- no loading spinner on every dashboard tile

Writes and AI go through **Route Handlers** (`app/api/*/route.ts`), which can validate,
rate-limit, and use secrets.

### Cache invalidation

Because reads bypass the API layer, mutations must invalidate explicitly. Every write
route calls `revalidateTag('business:<id>')` after a successful transaction. Missed
invalidation shows stale data — this is the main failure mode to watch in review.

---

## 4. Directory layout

Follows PRD section 20, with `lib/` split more finely than the PRD sketch.

```
qubators-business-studio/
├── app/
│   ├── (marketing)/           public landing, pricing, sign-up
│   ├── (auth)/                login, signup, verify, reset-password
│   ├── (dashboard)/           authenticated shell + navigation
│   │   ├── dashboard/
│   │   ├── business/[businessId]/
│   │   │   ├── plan/  brand/  products/  services/  customers/
│   │   │   ├── finance/  analytics/  campaigns/  tasks/  settings/
│   │   └── copilot/  ideas/  marketing/
│   ├── admin/                 PRD section 9
│   └── api/                   Route Handlers — see API.md
├── components/                presentational, no data fetching
├── lib/
│   ├── ai/        provider adapter, prompts, context builder, cost guard
│   ├── auth/      session helpers, membership checks
│   ├── database/  typed queries, no SQL strings in components
│   ├── email/     ZeptoMail client + templates
│   ├── money.ts   the ONLY place money is formatted
│   ├── validation/  Zod schemas
│   ├── supabase/    browser + server clients
│   └── analytics/ product event tracking
├── database/migrations/       numbered SQL
├── docs/
├── public/
├── tests/
├── .env.example
└── proxy.ts                  session refresh (Next 16 renamed middleware -> proxy) + route protection
```

`lib/money.ts` is the single point of truth for currency handling. See
[DATABASE.md](./DATABASE.md#1-the-three-rules-that-shape-everything).

---

## 5. Module boundaries

Enforced by convention and lint rules, so a module cannot quietly reach another's data.

| Module | May import | Must never import |
|---|---|---|
| `components/` | `lib/money`, `lib/validation` | `lib/database`, `lib/ai` |
| `lib/ai` | `lib/database` (read-only), provider SDK | `components` |
| `lib/email` | templates | `lib/ai` |
| `app/api/*` | all of `lib/` | `components` |

A component that writes to the database is an architecture violation. Components are for
display; data lives in Server Components or route handlers.

---

## 6. AI architecture

The PRD calls the Copilot the core differentiator and lists AI inaccuracy and AI cost as
the two headline risks. Four mechanisms address them.

**6.1 Business context injection.** Before each call, `lib/ai/context.ts` assembles a
compact context block from the business: industry, location, target customer, products,
price range, brand personality, goals. This is what makes the Copilot "business-aware"
rather than a generic chatbot.

**6.2 Assumption labelling — mandatory.** The PRD (section 7) requires AI output to
identify assumptions and never guarantee profit. Enforced in three places:
- prompts instruct the model to separate verified from assumed
- structured output is parsed into `{ content, assumptions[] }`
- `assumptions` is persisted on the message and rendered in the UI

A generator that cannot produce a parseable `assumptions` array fails closed. The PRD's
rule that AI suggestions must be visibly distinct from verified market research is a
product requirement, not a nice-to-have.

**6.3 Two-model routing.** Cheap model for chat, summaries and short copy; stronger model
for business plans, brand strategy and long documents. Configured in `.env.example`.

**6.4 Cost guard.** `ai_usage` records every call. A Postgres trigger raises when a user
exceeds `AI_REQUESTS_PER_USER_PER_DAY`. Caching by prompt hash on the free-tier path.
Without this, one user can bankrupt the AI budget.

---

## 7. Email

ZeptoMail, per PRD section 5. All transactional mail: verification, password reset,
welcome, customer notifications, receipts.

Hard requirements:
- the API token is **server-side only**
- sending requires a domain **you control** with DNS verification — not a Gmail address
- the `from` domain must be authenticated, or deliverability collapses

Templates are React components in `lib/email/templates/`, rendered to HTML on the server.

---

## 8. Security posture

Against PRD section 15.

| Control | Implementation |
|---|---|
| Passwords | Supabase Auth — never stored or compared by us |
| Sessions | Supabase auth cookies, `httpOnly`, `secure` in production |
| Authorization | RLS on every table; membership check in `lib/auth` |
| Input validation | Zod at every API boundary, before any write |
| Rate limiting | Per-user on AI and auth routes; Supabase edge rate limits |
| Secrets | `.env.local`, git-ignored; `.env.example` holds names only |
| SQL injection | No string-built SQL; Supabase query builder or parameterised statements |
| Audit logging | `ai_usage` plus an `audit_log` table for sensitive writes |
| HTTPS | Enforced in production by Vercel |

**Two things that will be forgotten unless enforced in CI:**
1. A secret-scanning pre-commit hook or CI step. Otherwise the ZeptoMail token gets
   committed by accident.
2. A test asserting no `SUPABASE_SERVICE_ROLE_KEY` appears in any client bundle.

---

## 9. Performance

Target: first load under 3 seconds (PRD section 16).

- Server Components mean data arrives with the HTML
- Images through Supabase Storage with transforms, `next/image`
- Route-level code splitting by default
- Dashboard queries indexed on `(business_id, created_at DESC)`
- AI calls never block a page render — they stream from a Route Handler

---

## 10. Deployment

Vercel, connected to the GitHub repo. Preview deployments per pull request, production
on merge to `main`.

Environment variables set in Vercel, never in the repo. `APP_SECRET` differs per
environment — a preview deployment must not be able to forge a production tracking link.
