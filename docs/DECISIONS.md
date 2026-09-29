# Decisions — Qubators Business Studio

Architecture decision records. Newest last. Each records what was decided, why, and what
would change it.

---

## ADR-0: `docs/PRD.md` is the source of truth

**Status:** Accepted · 28 Sep 2026

An earlier prototype was built to a different brief — a design-studio operations tool for
orders, designs and consultations. It shares the product name but is a different product
from the AI business-creation platform in the PRD.

**Decision:** the PRD governs. The prototype is archived in `archive/legacy-prototype/`
and is reference material only — its `styles.css` design system is the one genuinely
valuable artefact.

**Revisit if:** a design-studio product is confirmed as a second product line. It would
need its own name and its own repository.

---

## ADR-1: Launch currency is UGX, with multi-currency from day one

**Status:** Accepted · 28 Sep 2026

The PRD targets Uganda first and lists UGX, KES, TZS, RWF, USD, GBP, EUR.

**Decision:** `UGX` is the default. Currency lives on `businesses.currency` as an ISO 4217
code. Money is stored as `*_minor` integers. Formatting happens in exactly one place,
`lib/money.ts`.

**Why it matters:** the discarded prototype hard-coded `৳` and `en-US` formatting, which
would have required a painful migration of every amount in the database.

**Revisit if:** a market is added outside the listed set. Only the allow-list changes —
the storage model is currency-agnostic.

---

## ADR-2: `business_plans.sections` is `JSONB`, not a normalised table

**Status:** Accepted · 28 Sep 2026

The PRD's business plan has a fixed 16 named sections. They are read and written as a
whole, never queried individually.

**Decision:** store the plan as one `JSONB` document.

**Rejected:** a `business_plan_sections` table with 16 rows. It would buy the ability to
query individual sections, which nothing needs, at the cost of 16 inserts, a transaction
and a far harder UI contract.

**Revisit if:** section-level search, section-level re-generation, or comparing two
versions section by section becomes a requirement. Migration is then a straight
`INSERT ... SELECT` from the JSONB document.

---

## ADR-3: AI provider behind an adapter

**Status:** Accepted · 28 Sep 2026

**Decision:** all model access goes through `lib/ai/provider.ts`, an interface with one
method. Two models are configured: a fast one for chat and short copy, a quality one for
plans and brand strategy.

**Why:** the PRD lists model choice nowhere and AI cost as a top-three risk. Locking in a
vendor would make the cost lever unreachable. The adapter also keeps prompt engineering
and cost accounting in our code rather than a vendor's SDK.

**Revisit if:** a specific provider is chosen for regional availability or pricing.

---

## ADR-4: AI output must carry `assumptions`; the route fails closed

**Status:** Accepted · 28 Sep 2026

PRD section 7 requires AI output to identify assumptions and not present unverified
information as fact.

**Decision:** every generative route parses the model response into
`{ content, assumptions[] }`. A response without a parseable `assumptions` array returns
`422 AI_UNPROCESSABLE`. Assumptions are persisted on the message and rendered in the UI.

**Why not just instruct the model:** an unparseable response is a bug report you can see.
"Trust me, the model mentioned assumptions somewhere in that paragraph" is not.

---

## ADR-5: Build order is 2 → 4 → 3, not the PRD's 1 → 2 → 3

**Status:** Accepted · 28 Sep 2026

The PRD's phase plan puts the AI engine in Phase 3, before finance, analytics and campaigns.

**Decision:** build the business engine and the management modules before the AI engine.

**Why:** AI is the riskiest and least predictable part of the build. If it slips, the
product must still be worth launching. Non-AI modules also produce the data the AI needs
— a Copilot with no products, customers or transactions to reason about is not
business-aware, it is a chatbot.

**Revisit if:** never. This is a risk-ordering argument, not a preference.

---

## ADR-6: Read the PRD's 19 entities as 22

**Status:** Accepted · 28 Sep 2026

**Decision:** add `order_items`, `business_members` and `ai_usage`.

- `order_items` — an order with a single `product_id` cannot hold four products. The
  PRD's `orders` entity is under-specified.
- `business_members` — required the moment a second person touches a business, and needed
  for the V2 team-accounts feature. Without it `business_id` has no defined owner.
- `ai_usage` — the PRD names AI cost as a key risk but gives it nowhere to record usage,
  so per-user cost limits cannot be enforced.

**Revisit if:** never. All three are additive.

---

## ADR-7: The archived prototype's design system is the theme source

**Status:** Accepted · 28 Sep 2026

**Decision:** port the token, component and state patterns from
`archive/legacy-prototype/assets/css/styles.css` — light and dark themes, focus states,
accessible form patterns — into Tailwind as the design system.

**Why:** it is the only reusable artefact from the discarded work, and it already encodes
accessibility and dark-mode decisions that would otherwise be re-made.

**Explicitly not ported:** its data layer, its currency handling, its authentication, and
all of its views.

---

## ADR-8: Defer team accounts, but create the table

**Status:** Accepted · 28 Sep 2026

**Decision:** build only owner-only access for the MVP, but ship `business_members` from
day one and route every authorisation check through it.

**Why:** adding a second user later means backfilling membership rows and revisiting every
RLS policy. The table costs nothing now; the migration costs a week later.

---

## ADR-9: Next.js 16, and no webfonts

**Status:** Accepted · 28 Sep 2026

**Version.** `create-next-app@latest` produced **16.3.6** at scaffold time, not the 15
this document originally named. Scaffolding followed the current stable rather than
pinning an older major to match a paragraph written three days earlier.

**Rationale:** 16 is the current stable with security fixes and a matured App Router. The
architecture document is ours to correct, not a constraint on the product. If 16 causes
trouble, the fallback is pinning 15 — `create-next-app@15` — and recording the reason.

**No webfonts.** The generated `app/layout.tsx` imported Geist from `next/font/google`,
which issues a build-time and runtime request to Google Fonts. That was removed. The app
now uses a system font stack defined in `app/globals.css` under `@theme inline`.

**Rationale:** the project previously committed to making zero external network requests.
A framework default should not quietly reverse a stated product decision. It also means
the app renders identically offline and in Uganda, where font-CDN latency and reachability
are less reliable than on a developer's machine.

**Enforcement:** a test asserts no `next/font/google` import exists in `app/`. If someone
adds a webfont, the test fails.

---

## ADR-10: Node 24, not Node 20

**Status:** Accepted · 28 Sep 2026

Node **20.20.2** was installed first, on the reasonable grounds that it was the LTS line
at the time. That was wrong. `@supabase/supabase-js@2.117.2` and its dependencies
(`@supabase/realtime-js`, `@supabase/storage-js`) declare `engines.node: ">=22.0.0"`, and
npm surfaces the mismatch only as a warning — the install appears to succeed and the
failure surfaces later, at runtime.

**Decision:** **Node 24 LTS** (24.21.0, "Krypton"). `package.json` pins
`"engines": { "node": ">=22.0.0" }` so a Node 20 machine fails fast and loudly at install
time rather than mysteriously at runtime.

**Note on Next.js:** Next 16.3.6 itself only requires `>=20.9.0`. The constraint comes
entirely from Supabase. Worth checking *transitive* engines, not just the framework's own.

**Install method:** official `.zip` extracted to a user-writable folder, not the MSI
installer. The MSI path failed on this machine with error 1603 and a wedged Windows
Installer (error 1618 on every retry), and `winget` hung for 39 minutes. The zip needs no
elevation and is reproducible.

---

## ADR-11: The repository must live outside OneDrive

**Status:** Accepted · 28 Sep 2026

The repository was created at
`C:\Users\ashab\OneDrive\Documents\GitHub\QubatorsBuisnessStudio`, inside a OneDrive-synced
folder. `npm install` there was measured at **~60 files/second**, writing 414 MB across
18,000+ files, and did not complete. The identical install in a non-synced temp directory
finished in 5 minutes.

**Decision:** work from a local path such as `C:\dev\QubatorsBuisnessStudio`. OneDrive
should hold documents, not a build toolchain.

**Why this is not a data-loss concern:** `.gitignore` excludes `node_modules` and `.next`,
so GitHub is unaffected, and `origin` already holds every commit. OneDrive was providing
no backup that Git does not already provide, while making every npm command
(`install`, `dev`, `build`, `test`) roughly an order of magnitude slower.

**Revisit if:** never. This is a filesystem-placement fact, not a preference.

---

## ADR-12: Migrations live in `supabase/`, not the PRD's `database/`

**Status:** Accepted · 28 Sep 2026

PRD section 20 proposes a `database/` directory for migrations. The first schema was
written there.

**Decision:** use `supabase/migrations/` and `supabase/seed.sql` instead.

**Why:** the Supabase CLI only reads those two paths. `supabase db push` applies
**nothing** when migrations live anywhere else — no error, no warning, just an empty
database that looks like a successful deploy. That is the worst possible failure mode
for a schema push.

The PRD's directory sketch is a guideline; a working deployment path is not negotiable.
`docs/PRD.md` is left unmodified as the source of truth, and this ADR records the
deviation.

Migration files are renamed to the CLI's `<timestamp>_<name>.sql` convention so ordering
is explicit rather than inferred from a hand-written number.

---

## ADR-13: Auth users are created through the auth API, never with SQL

**Status:** Accepted · 29 Sep 2026

`supabase/seed.sql` originally created the demo login by inserting directly into
`auth.users`. That produced a user that existed, was email-confirmed, and had a valid
bcrypt hash — and could not sign in. GoTrue answered every attempt, right password or
wrong, with `500 unexpected_failure: "Database error querying schema"`. The app showed
this to the founder as a generic "incorrect" message on a correct password.

Two distinct faults, both from hand-writing rows into a table that Supabase owns:

1. **No `auth.identities` row.** Supabase records a login in two tables. Inserting only
   `auth.users` leaves GoTrue unable to resolve the identity.
2. **bcrypt cost 6.** `gen_salt('bf')` defaults to cost 6. GoTrue expects cost 10 and
   rejects the cheaper hash.

The row was worse than inert: while it existed, *every* lookup against `auth.users`
failed, including a brand-new signup from a different address. One malformed row broke
auth for the whole project.

**Decision:** never write to `auth.users` from SQL. `scripts/repair-demo-user.mjs` creates
the account through `POST /auth/v1/signup` and the seed only attaches business data to a
user that already exists. Related: `auth.identities.email` is `GENERATED ALWAYS` on
current Supabase, so it cannot be inserted into directly and is derived from
`identity_data`.

**Why it matters:** `auth.*` is Supabase's schema, not ours. Its invariants are not
documented in a way that hand-written inserts can satisfy reliably.

**Revisit if:** Supabase publishes a supported seed path for `auth.users`. Until then, use
the API.

---

## ADR-14: Migrations must GRANT explicitly on the API roles

**Status:** Accepted · 29 Sep 2026

Migrations 0001–0003 created 21 tables and attached 42 RLS policies but never granted
anything to `anon`, `authenticated` or `service_role`. Supabase's automatic grants only
apply to objects created by the platform's own role, so tables created by a direct
connection got no privileges.

Every read and write returned `403 permission denied for table businesses`, with
Postgres suggesting the fix. **RLS was never consulted** — a missing table privilege is
checked before row security, so the entire tenant-isolation model was inert. The pages
still returned 200, because the failure happened on the data fetch, not the render.

**Decision:** migration `0004_grants.sql` grants `select, insert, update, delete` on all
public tables to `authenticated`, plus `execute` on functions and `usage` on the schema.
Crucially it also sets `ALTER DEFAULT PRIVILEGES`, so tables added by migration 0005 and
later are granted automatically and this cannot silently regress again.

`anon` is granted nothing on purpose: all public tables hold tenant data, and refusing
signed-out requests in the database is safer than relying on the application layer not
being bypassed.

**Why it matters:** a green build, a 200 response and 42 RLS policies can all coexist with
total data loss at runtime. Permissions are part of the schema and belong in the same
transaction as the tables.

**Revisit if:** never. This is not a preference; a missing GRANT is a bug.

---

## Open questions

| # | Question | Blocks | Owner |
|---|---|---|---|
| 1 | LLM provider and budget ceiling | Phase 3 | — |
| 2 | Supabase project created? | Phase 1 | — |
| 3 | Domain owned, for ZeptoMail sender verification? | Phase 5 | — |
| 4 | Licence — MIT assumed, unconfirmed | before any public release | — |
| 5 | Registration open at launch, or invite-only? | Phase 1 | — |
| 6 | Free tier limits: AI calls per month, businesses per user? | Phase 1 | — |
| 7 | Mobile app (PRD V3) — PWA first, or native? | post-MVP | — |
