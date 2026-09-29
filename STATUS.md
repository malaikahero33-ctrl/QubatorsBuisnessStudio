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
| **Money module** | Renders "USh" - the zero-decimal UGX path |
| **Dark mode** | Three-state toggle, persists across reload, no flash |

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
| 4 | Business profile | create form only, no edit page |
| 5 | AI Business Copilot | not started — needs an LLM key |
| 6 | Idea generator | not started — needs an LLM key |
| 7 | Business plan generator | not started — needs an LLM key |
| 8 | Brand generator | not started — needs an LLM key |
| 9 | Product management | **done, verified** |
| 10 | Marketing content | not started — needs an LLM key |
| 11 | Customer management | **done, verified** |
| 12 | Financial tracking | not started |
| 13 | Notifications / email | schema only, no code |
| 14 | Settings | not started |

Not in the PRD MVP but in the schema: order tracking, campaigns, tasks,
analytics, subscriptions, multi-business.

---

## The AI blocker

**Five of the fourteen MVP items are the AI engine, and none can run without an
LLM API key.** This is open question 1 in `docs/DECISIONS.md`.

The adapter, the assumption contract and the token shapes already exist:
- `lib/ai/provider.ts` — vendor-agnostic interface, two model tiers
- `lib/validation/schemas.ts` — `aiEnvelopeSchema` requires a non-empty
  `assumptions` array, so a response without one cannot be shown

What is missing is a concrete provider implementation and the routes and UI
around it. That is a day of work *plus* the key.

**What can be built without the key:** every route, the prompt library, the
streaming, the UI, and a clear "configure your key" state. The app is
functional and testable; only the model calls need the credential.

---

## Known gaps, stated plainly

1. **No tests against a real database.** 36 unit tests cover money and
   validation only. RLS policies have never been tested for the failure case —
   specifically, that user B cannot read user A's data.
2. **No error boundary.** An unexpected throw in a Server Component shows the
   Next.js error page. Production needs `app/error.tsx`.
3. **No loading states.** Pages block until data arrives. The PRD's 3-second
   target is met locally but untested under load.
4. **Multi-business is half-built.** `business_members` and the RLS policies
   are designed for it; `getCurrentBusiness` just takes the first row.
5. **No test framework for components.** The duplicate `<h1>` and the
   duplicated title were found by taking a screenshot, not by any check.
6. **Dev server is slow** — one page took 2.3 minutes to compile. Production
   builds are unaffected.
7. **The database password is in this repository's git history**
   discussion and was shared in chat. Rotate it before any real deployment.

---

## The order things were built in, and why

Money first, because it is the one thing that cannot be fixed later without
migrating every row. Then auth, because everything is scoped by it. Then the
schema, because RLS and generated columns are cheaper before there is data.

The business modules came last because they are the least risky to get
wrong — a product form either works or it does not, but a currency column
chosen wrongly costs a rewrite.
