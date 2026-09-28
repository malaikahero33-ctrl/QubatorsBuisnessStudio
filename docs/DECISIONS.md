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
