# Database — Qubators Business Studio

Design for Supabase (PostgreSQL). Entity list follows PRD section 14; this document
resolves the ambiguities in it.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [API.md](./API.md) · [DECISIONS.md](./DECISIONS.md)

---

## 1. The three rules that shape everything

### 1.1 Money is always an integer, in minor units

Never store a decimal amount. Never store a currency symbol.

| Wrong | Right |
|---|---|
| `price DECIMAL(10,2)` | `price_minor BIGINT` |
| `"total": 1500.50` | `"total_minor": 150050, "currency": "UGX"` |
| `"currency": "৳"` | `"currency": "UGX"` |

`BIGINT`, not `INTEGER`. A business could record a large annual transaction, and
`INT` caps at ~2.1 billion minor units. UGX is a **zero-decimal** currency, so
`10000` minor units renders as `UGX 10,000` — the `*_minor` convention handles both
zero-decimal and two-decimal currencies without special cases.

Format only at the display edge:

```ts
new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 10 ** decimals)
```

The `*_minor` → display conversion lives in one place: `lib/money.ts`. No other module
formats money.

### 1.2 Currency belongs to the business, not the user

`businesses.currency` is the ISO 4217 code for that business. A row in
`products`, `transactions` or `orders` inherits it. It is stored on transactions too,
**denormalised on purpose** — so a later currency change never silently rewrites history.

Supported at launch: `UGX` (default, zero-decimal), `KES`, `TZS`, `RWF`, `USD`, `GBP`, `EUR`.
Note `TZS` is also zero-decimal.

### 1.3 Every business-scoped table has `business_id`

Non-negotiable. It is the tenant boundary, the RLS key, and the join key for
multi-business workspace (PRD section 6). There are no exceptions.

---

## 2. Entity map

```
auth.users  (Supabase-managed)
     │ 1
     │
     ▼ 1
  profiles ──1:N──1 businesses ──1:N──┬── products
     │                    │            ├── services
     │                    │            ├── customers ──1:N── orders ──1:N── order_items
     │                    │            ├── transactions
     │                    │            ├── expenses
     │                    │            ├── campaigns ──1:N── campaign_content
     │                    │            ├── tasks
     │                    │            ├── brand_assets
     │                    │            ├── business_plans
     │                    │            ├── ai_conversations ──1:N── ai_messages
     │                    │            └── notifications
     │                    └──1:1── business_settings
     │ 1
     └──1:N── subscriptions
```

---

## 3. Tables

The PRD lists 19 entities. Three changes, each for a stated reason:

1. **`order_items` added.** An order with a single `product_id` cannot represent an order
   of four products. The PRD's `orders` entity is under-specified.
2. **`business_members` added.** Required for the V2 "team accounts" feature and for any
   non-owner access. Without it, `business_id` is ambiguous the moment a second person
   exists. Cheap now, painful later.
3. **`ai_usage` added.** The PRD lists AI cost as a key risk (section 23) but provides
   nowhere to record usage. Without it, per-user cost limits cannot be enforced.

### 3.1 `profiles`

Mirrors `auth.users`; created by trigger on signup.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, FK → `auth.users(id)` ON DELETE CASCADE |
| `full_name` | `text` | |
| `avatar_url` | `text` | Supabase Storage URL |
| `phone` | `text` | E.164 |
| `country_code` | `char(2)` | ISO 3166-1 alpha-2 |
| `onboarding_complete` | `boolean` | default `false` |
| `created_at` / `updated_at` | `timestamptz` | |

### 3.2 `businesses`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `owner_id` | `uuid` | FK → `profiles(id)` |
| `name` | `text` | NOT NULL |
| `slug` | `text` | UNIQUE, URL-safe, for shareable business-plan links |
| `industry` | `text` | feeds AI context |
| `location` | `text` | |
| `stage` | `text` | `idea` → `planning` → `branding` → `launched` → `growing` |
| `currency` | `char(3)` | ISO 4217, default `UGX` |
| `locale` | `text` | default `en-UG` |
| `timezone` | `text` | default `Africa/Kampala` |
| `logo_url` | `text` | |
| `target_customer` | `text` | AI context |
| `price_range_minor` | `bigint` | AI context |
| `price_range_maxor` | `bigint` | AI context |
| `brand_personality` | `text` | AI context |
| `goals` | `text` | AI context |
| `created_at` / `updated_at` | `timestamptz` | |

Index: `slug` unique, `owner_id`.

### 3.3 `business_settings`

One-to-one with `businesses`, `business_id` as PK. Holds non-AI-context preferences:
notification flags, report cadence, onboarding checklist state, feature toggles.

### 3.4 `business_members`

| Column | Type | Notes |
|---|---|---|
| `business_id` | `uuid` | PK part 1, FK → `businesses` CASCADE |
| `user_id` | `uuid` | PK part 2, FK → `profiles` CASCADE |
| `role` | `text` | `owner` \| `admin` \| `editor` \| `viewer` |
| `invited_at` / `joined_at` | `timestamptz` | |

### 3.5 `products` and `services`

Same shape, separate tables — a product is stock-tracked, a service is time-based. Merging
them would force nullable fields on both.

Shared columns: `id`, `business_id`, `name`, `description`, `category`,
`price_minor BIGINT`, `cost_minor BIGINT`, `image_url`, `is_active`,
`created_at`, `updated_at`.

`products` adds: `sku TEXT`, `inventory_count INTEGER DEFAULT 0`,
`reorder_level INTEGER`, `low_stock_threshold INTEGER`.
`services` adds: `duration_minutes INTEGER`, `requirements TEXT`,
`availability TEXT` (`available` \| `limited` \| `unavailable`).

### 3.6 `customers`

PRD section 6 gives the stages explicitly: `lead` → `prospect` → `customer` →
`returning` → `vip`.

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK |
| `business_id` | `uuid` | FK CASCADE |
| `name` | `text` | NOT NULL |
| `email` / `phone` | `text` | |
| `location` | `text` | |
| `stage` | `text` | enum above, default `lead` |
| `notes` | `text` | |
| `first_order_at` | `timestamptz` | denormalised, for "returning" detection |
| `lifetime_value_minor` | `bigint` | **derived** — recompute on order write, never hand-entered |
| `created_at` / `updated_at` | `timestamptz` | |

Index: `(business_id, stage)`, `(business_id, email)`.

### 3.7 `orders` and `order_items`

`orders`: `id`, `business_id`, `customer_id`, `order_number TEXT` (unique per business,
human-facing, e.g. `QB-1001`), `status` (`pending`/`confirmed`/`in_progress`/`shipped`/
`completed`/`cancelled`), `total_minor BIGINT`, `currency char(3)`,
`placed_at`, `due_at`, `notes`.

`order_items`: `id`, `order_id`, `product_id` (nullable), `service_id` (nullable),
`description TEXT`, `quantity INTEGER`, `unit_price_minor BIGINT`,
`line_total_minor BIGINT`. Exactly one of `product_id` / `service_id` set — enforce with a
CHECK constraint.

### 3.8 `transactions` and `expenses`

`transactions`: `id`, `business_id`, `customer_id` (nullable), `type` (`income` |
`expense`), `amount_minor BIGINT NOT NULL CHECK (amount_minor > 0)`,
`currency char(3) NOT NULL`, `category TEXT`, `description TEXT`,
`occurred_at timestamptz`, `order_id` (nullable link), `recorded_by uuid`.

`expenses` is kept separate rather than as a `type` row because expense reporting needs
different fields: `vendor`, `receipt_url`, `recurring` (bool), `recurrence_rule`.

`amount_minor > 0` plus the `type` column is deliberate: the sign is not encoded in the
number, so a sum cannot silently mix directions.

### 3.9 `campaigns` and `campaign_content`

`campaigns`: `id`, `business_id`, `name`, `goal`, `audience`, `channel`,
`budget_minor BIGINT`, `currency char(3)`, `starts_at`, `ends_at`, `status`,
`reach`, `engagement`, `leads`, `conversions`, `revenue_minor`, `created_at`.

`campaign_content`: `id`, `campaign_id`, `business_id`, `content_type`
(`social_post`/`ad`/`email`/`blog`/`whatsapp`/`product_description`),
`body TEXT`, `variant TEXT`, `ai_generated BOOLEAN DEFAULT false`,
`ai_model TEXT`, `approved_at timestamptz`, `created_at`.

Storing `business_id` on `campaign_content` is deliberate: it keeps every
business-scoped table uniformly filterable, which makes RLS policies uniform too.

### 3.10 `tasks`

`id`, `business_id`, `title`, `description`, `status` (`todo`/`in_progress`/`done`),
`priority`, `due_at`, `completed_at`, `source` (`manual`|`ai_roadmap`|`ai_copilot`),
`related_entity_type`, `related_entity_id`, `created_at`.

### 3.11 `brand_assets`

`id`, `business_id`, `asset_type` (`name`/`tagline`/`mission`/`vision`/`values`/
`personality`/`colors`/`typography`/`logo_concept`/`guidelines`),
`content TEXT`, `is_primary BOOLEAN DEFAULT false`, `ai_generated BOOLEAN`,
`ai_model TEXT`, `created_at`.

Row-per-asset rather than one wide row, so new asset types need no migration.

### 3.12 `business_plans`

`id`, `business_id`, `version INTEGER DEFAULT 1`, `status` (`draft`/`final`),
`sections JSONB`, `prompt TEXT`, `ai_model TEXT`, `ai_generated_at`,
`share_token TEXT UNIQUE`, `created_at`, `updated_at`.

`sections` is `JSONB` holding the PRD's 16 named sections. Rationale and the
`normalised` alternative are recorded in [DECISIONS.md](./DECISIONS.md).

### 3.13 `ai_conversations` and `ai_messages`

`ai_conversations`: `id`, `business_id`, `user_id`, `title`, `model`,
`system_context_snapshot JSONB`, `created_at`.

`system_context_snapshot` freezes the business facts used for that conversation, so a
chat can be audited and reproduced after the business changes.

`ai_messages`: `id`, `conversation_id`, `business_id`, `role` (`user`|`assistant`|`system`),
`content TEXT`, `model`, `input_tokens INTEGER`, `output_tokens INTEGER`,
`latency_ms INTEGER`, `assumptions JSONB`, `created_at`.

`assumptions` stores the assumptions the model stated. The PRD (section 7) requires AI
output to identify assumptions — persisting them makes that auditable rather than a
promise.

### 3.14 `ai_usage`

`id`, `user_id`, `business_id`, `feature` (`copilot`/`idea`/`plan`/`brand`/`marketing`),
`model`, `input_tokens`, `output_tokens`, `estimated_cost_micros BIGINT`,
`created_at`. Index on `(user_id, created_at)` for rate limiting. Feeds
`AI_REQUESTS_PER_USER_PER_DAY`.

### 3.15 `notifications`

`id`, `user_id`, `business_id`, `type`, `title`, `body`, `data JSONB`,
`channel` (`in_app`|`email`), `read_at`, `sent_at`, `created_at`.

### 3.16 `subscriptions`

`id`, `business_id`, `plan` (`free`/`starter`/`pro`/`enterprise`), `status`,
`provider`, `provider_customer_id`, `provider_subscription_id`,
`current_period_start`, `current_period_end`, `cancel_at_period_end`,
`created_at`, `updated_at`.

---

## 4. Row-level security

Non-negotiable. The service-role key bypasses RLS, so any code path that reaches the
database with that key must be extremely narrow.

| Table | Policy |
|---|---|
| `profiles` | `auth.uid() = id` |
| `businesses` | `id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid())` |
| all `business_id` tables | `business_id IN (SELECT business_id FROM business_members WHERE user_id = auth.uid())` |
| `ai_usage` | `user_id = auth.uid()` |
| `subscriptions` | via `business_id` membership |

Membership is a `SECURITY DEFINER` function so a policy can read `business_members`
without recursing into its own policy.

---

## 5. Indexes

Beyond those listed per table:

- Every `business_id` gets a leading index — it is in nearly every filter.
- `(business_id, created_at DESC)` on `orders`, `transactions`, `tasks` for list views.
- Full-text `GIN` on `products(name, description)`, `customers(name, email)`.
- Partial index on `orders WHERE status IN ('pending','in_progress')` for the dashboard.
- `ai_messages(conversation_id, created_at)`.

---

## 6. Triggers

| Trigger | Effect |
|---|---|
| `on_auth_user_created` | Insert `profiles` row |
| `set_updated_at` | Maintain `updated_at` on every mutable table |
| `on_business_plan_published` | Generate `share_token` |
| `recompute_customer_ltv` | After an order reaches `completed`, update `lifetime_value_minor` and `first_order_at` |
| `guard_ai_usage` | Insert `ai_usage`; raise if the daily cap is exceeded |

## 7. Migrations

Plain SQL in `supabase/migrations/`, numbered `0001_`, `0002_`, … and applied in order
via the Supabase CLI. Never edit an applied migration — add a new one.
