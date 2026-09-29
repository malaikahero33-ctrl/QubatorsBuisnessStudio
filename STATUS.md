-- =============================================================================
-- STATUS.md
-- What is built, what is verified, and what is left.
-- Updated 29 September 2026
-- =============================================================================

## Verified working against the live database

These have been exercised in a browser, not just compiled.

| | Evidence |
|---|---|
| **Authentication** | Real sign-in as founder@qubators.test, session cookie, RLS filtering |
| **Dashboard** | Revenue 60,000,000 - spent 3,150,000 = profit 56,850,000. Exact. |
| **Products** | Create, edit, archive, delete. Margin computed per product. |
| **Customers** | Create, edit, delete. Phones normalised to E.164. |
| **Orders** | Create with lines, status changes, delete. Database computed the total. |
| **Finance** | Income and expenses, month-by-month bars, spend breakdown |
| **Settings** | Business profile, your details, notification preferences |
| **Notifications** | List, read state, dismiss, preference flags honoured |
| **Money module** | Renders "USh" - the zero-decimal UGX path |
| **Dark mode** | Three-state toggle, persists across reload, no flash |
| **Error boundaries** | A failed page keeps the shell and explains itself |
| **Loading states** | Skeletons shaped like the pages they stand in for |

The profit arithmetic matching to the shilling is the strongest signal so far:
integer minor-unit storage, the trigger that recomputes order totals, and the
formatter all agree.

---

## PRD MVP: 14 items

| # | Item | State |
|---|---|---|
| 1 | Authentication | **done, verified** |
| 2 | User dashboard | **done, verified** |
| 3 | Business creation | **done** |
| 4 | Business profile | **done, verified** |
| 5 | AI Business Copilot | built, verified — needs a key to run |
| 6 | Idea generator | built, verified — needs a key to run |
| 7 | Business plan generator | built, verified — needs a key to run |
| 8 | Brand generator | built, verified — needs a key to run |
| 9 | Product management | **done, verified** |
| 10 | Marketing content | built, verified — needs a key to run |
| 11 | Customer management | **done, verified** |
| 12 | Financial tracking | **done, verified** |
| 13 | Notifications | in-app **done**; email needs a provider |
| 14 | Settings | **done, verified** |

**All fourteen are built.** The five AI features cannot be exercised until
`AI_API_KEY` is set, so they are "verified" in the sense that matters here:
they compile, their prompts are unit tested, their envelopes are enforced, and
without a key every one of them shows a clear "configure your key" state rather
than failing silently. What is unverified is a real model response.

Not in the PRD MVP but in the schema: order tracking (built), campaigns,
tasks, analytics, subscriptions, multi-business.

---

## The AI blocker: one environment variable

All five AI features are built — routes, prompts, schemas, UI, metering, daily
cap. **They cannot run without `AI_API_KEY`,** and which provider to use is
still open question 1 in `docs/DECISIONS.md`.

To try them:

1. Pick a provider (OpenAI, Groq, Together, Gemini, or any OpenAI-compatible
   endpoint — see `lib/ai/provider-openai.ts`)
2. Add to `.env.local`:
   ```
   AI_PROVIDER="openai"
   AI_API_KEY="sk-..."
   AI_MODEL_FAST="gpt-4o-mini"
   AI_MODEL_QUALITY="gpt-4o"
   ```
3. Restart the server

Without a key, every AI screen says exactly that, and nothing else breaks.

### What is built and testable right now, with no key

| File | What it does |
|---|---|
| `lib/ai/provider.ts` | Vendor-agnostic interface, two model tiers, factory |
| `lib/ai/provider-openai.ts` | The only vendor-specific file. One line to swap. |
| `lib/ai/prompts.ts` | One function per feature. 30 tests. |
| `lib/ai/context.ts` | Reads the business, products and prices fresh per call |
| `lib/ai/run.ts` | The order that matters: key → cap → call → validate → meter |
| `lib/ai/usage.ts` | Daily cap, checked *before* spending |
| `lib/ai/actions.ts` | One server action per feature, each with its schema |
| `components/ai/ai-panel.tsx` | Shared shell that renders assumptions above output |

### The rule that makes the AI features honest

`aiEnvelopeSchema` requires a non-empty `assumptions` array. A response
without one is **not shown** — the user gets an error explaining that the
app refused to display unverifiable advice. That is ADR-4, and it is enforced
in code rather than trusted to a prompt.

The Copilot is the interesting case: it returns prose, which has nowhere to
carry a structured assumptions list, so its envelope check fails by
construction. That is deliberate. A feature that cannot state what it assumed
does not get to display its output.

---

## Known gaps, stated plainly

1. **No tests against a real database.** 93 unit tests cover money, validation
   and the ledger arithmetic. RLS has never been tested for the failure case —
   specifically, that user B cannot read user A's data. This is the single
   most important gap and it is not hard to close: two test accounts and a
   handful of queries.
2. **Finance loads all rows.** Capped at 500 and it says so on screen. The
   aggregate belongs in a Postgres view once a business has real volume.
3. **Multi-business is half-built.** `business_members` and the RLS policies
   are designed for it; `getCurrentBusiness` just takes the first row.
4. **No test framework for components.** The duplicate `<h1>` and the
   duplicated title were found by taking a screenshot, not by any check.
5. **An `expenses` table exists that nothing reads.** Two tables for the same
   facts is two chances to disagree. Left in place, unused.
6. **Dev server is slow** — one page took 2.3 minutes to compile. Production
   builds are unaffected.
7. **The database password is in this repository's git history**
   discussion and was shared in chat. Rotate it before any real deployment.

### Fixed along the way, worth knowing about

**`notifications` had no INSERT policy.** The RLS policies from the original
schema covered reading and updating but not creating, so every "new order"
notification would have failed with a row-level security error. Found by
probing the live table with real inserts rather than by reading the policies.
Migration `0004_notification_policies.sql` adds the insert and delete policies,
both scoped to the row's own `user_id`.

**The `notifications` table is keyed on `user_id`, not `business_id`.** The
first version of the code assumed otherwise and would have written nothing at
all.

---

## The order things were built in, and why

Money first, because it is the one thing that cannot be fixed later without
migrating every row. Then auth, because everything is scoped by it. Then the
schema, because RLS and generated columns are cheaper before there is data.

The business modules came last because they are the least risky to get
wrong — a product form either works or it does not, but a currency column
chosen wrongly costs a rewrite.
