# API — Qubators Business Studio

Route Handlers under `app/api/`. The PRD's endpoint list (section 13), resolved into a
concrete contract.

Related: [ARCHITECTURE.md](./ARCHITECTURE.md) · [DATABASE.md](./DATABASE.md)

---

## 1. Conventions

**Base:** `/api`. All JSON unless noted.

**Auth:** every route except `/api/auth/*` and `/api/health` requires a session.
Authorisation is enforced by RLS *and* an explicit membership check.

**Content type:** send and accept `application/json`.

**Money:** request and response fields are `*_minor` integers plus a `currency` ISO 4217
code. Never a float, never a symbol. See [DATABASE.md](./DATABASE.md).

**Envelope:** errors use one shape, always:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable", "fields": { "email": "Required" } } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Zod failed; `fields` populated |
| 401 | `UNAUTHENTICATED` | No valid session |
| 403 | `FORBIDDEN` | Authenticated, not a member of this business |
| 404 | `NOT_FOUND` | Missing, or hidden by RLS |
| 409 | `CONFLICT` | Duplicate slug, duplicate order number |
| 422 | `AI_UNPROCESSABLE` | Model output failed validation |
| 429 | `RATE_LIMITED` | Per-user cap hit; `Retry-After` set |
| 502 | `AI_PROVIDER_ERROR` | Upstream model failure |

A 404 is returned instead of a 403 when a resource belongs to another business — a 403
would confirm the record exists.

**Pagination:** `?limit=50&cursor=<opaque>`. Cursors, not offsets, so new rows do not
shift pages mid-scroll.

**Idempotency:** `POST /api/ai/*` accept `Idempotency-Key`. A repeat with the same key
returns the original result and does not bill the AI provider twice.

---

## 2. Auth — `/api/auth`

The PRD's `/api/auth` group maps onto Supabase Auth, which owns the credential flow. These
routes exist for the parts Supabase does not do for us.

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/auth/session` | Current user, profile, businesses, memberships |
| `POST` | `/api/auth/register` | Create account, trigger verification email |
| `POST` | `/api/auth/verify` | Consume email-verification token |
| `POST` | `/api/auth/resend-verification` | Rate-limited |
| `POST` | `/api/auth/forgot-password` | Always 200, whether or not the email exists |
| `POST` | `/api/auth/reset-password` | Consume recovery token, set new password |

`forgot-password` returning 200 for unknown addresses prevents account enumeration.

---

## 3. Businesses — `/api/businesses`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/businesses` | Every business the caller is a member of |
| `POST` | `/api/businesses` | Creates business + `business_settings` + owner `business_members` row, in one transaction |
| `GET` | `/api/businesses/:id` | 403 if not a member |
| `PATCH` | `/api/businesses/:id` | Partial update; `slug` changes need revalidation |
| `DELETE` | `/api/businesses/:id` | Owner only. Soft-delete first, purge after a grace window |
| `GET` | `/api/businesses/:id/summary` | Dashboard aggregate — counts, totals, recent activity |
| `POST` | `/api/businesses/:id/switch` | Sets the active business in the session |

Multi-business workspace (PRD section 6) means the active `business_id` is a session
concern, and **every** other route is scoped by it.

---

## 4. Catalog

### `/api/products` · `/api/services`

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/products` | `?search=`, `?category=`, `?is_active=`, cursor pagination |
| `POST` | `/api/products` | `price_minor` and `cost_minor` integers |
| `GET` | `/:id` | |
| `PATCH` | `/:id` | |
| `DELETE` | `/:id` | 409 if referenced by an order — soft-delete instead |

`GET /api/products/low-stock` returns items at or below `low_stock_threshold`.

`/api/services` is identical minus inventory, plus `duration_minutes` and `requirements`.

---

## 5. CRM — `/api/customers` · `/api/orders`

### `/api/customers`

`GET` supports `?stage=`, `?search=` and sorting. `POST` accepts a name plus optional
contact details. `PATCH` updates including `stage` — the PRD's
lead → prospect → customer → returning → vip progression.

`GET /api/customers/:id/orders` returns order history. `lifetime_value_minor` is derived
and is never accepted from the client.

### `/api/orders`

`GET` supports `?status=`, `?customer_id=`, `?from=`, `?to=`.
`POST` takes an array of `items[]` and computes `total_minor` **server-side** from
`unit_price_minor × quantity`. A client-supplied total is ignored — otherwise it is a
price-tampering hole.

`PATCH /api/orders/:id/status` transitions state and fires the right notification.

`GET /api/orders/:id/track` is the public read behind the customer journey:
order number + email must both match.

---

## 6. Finance — `/api/transactions` · `/api/expenses`

`GET /api/transactions?type=&from=&to=` with cursor pagination.
`POST` records income or expense, writes an `ai_usage`-style audit row, and updates the
customer's `lifetime_value_minor` when the transaction is linked to a completed order.

`GET /api/transactions/summary` returns income, expenses, profit, cash flow and budget
burn for a period.

`/api/expenses` adds `vendor`, `receipt_url` and recurrence fields.

The PRD (section 6) requires this module to state it is not professional accounting or
tax advice. That disclaimer is rendered in the UI, not just the docs.

---

## 7. Marketing — `/api/campaigns`

`GET`/`POST`/`PATCH`/`DELETE` on `/api/campaigns`; performance metrics live on the
campaign row. `/api/campaigns/:id/content` returns generated content, filterable by type.

---

## 8. Tasks — `/api/tasks`

`GET` with `?status=`, `?due_before=`, `?source=`. `PATCH /api/tasks/:id/complete` stamps
`completed_at`. Tasks generated by the AI roadmap carry `source='ai_roadmap'` and a link
back to the entity they came from.

---

## 9. Analytics — `/api/analytics`

Read-only aggregates, all scoped to the active business.

| Path | Returns |
|---|---|
| `/sales` | Revenue over time, by product and by customer |
| `/customers` | New vs returning, stage distribution, LTV |
| `/marketing` | Campaign performance, content engagement |
| `/finance` | Income, expenses, profit, cash flow |
| `/products` | Product performance, best and worst sellers |
| `/campaigns` | Reach, engagement, leads, conversions, revenue |

Per PRD section 17, business outcomes are reported as user-reported figures and are not
automatically attributed to Qubators.

---

## 10. AI — `/api/ai/*`

The PRD's most important group. Every route streams, and every route records `ai_usage`.

| Method | Path | Returns |
|---|---|---|
| `POST` | `/api/ai/chat` | Streaming assistant reply, business-aware |
| `GET` | `/api/ai/chat/:conversationId` | Message history |
| `DELETE` | `/api/ai/chat/:conversationId` | Clears a conversation |
| `POST` | `/api/ai/ideas` | Concepts, target markets, problems, value props, revenue models, risks |
| `POST` | `/api/ai/business-plan` | The 16 PRD sections |
| `GET` | `/api/ai/business-plan/:id` | Stored plan |
| `POST` | `/api/ai/brand` | Name, tagline, mission, vision, values, personality, colours, typography, logo concepts |
| `POST` | `/api/ai/marketing` | Social posts, ads, product descriptions, email campaigns, blog posts, WhatsApp messages |

**All generative routes return the same envelope**, so the UI renders one component for
every AI surface:

```json
{
  "content": { "...": "generated output" },
  "assumptions": ["Assumed a solo founder", "Assumed urban customers in Kampala"],
  "model": "gpt-4o",
  "usage": { "input_tokens": 812, "output_tokens": 1460 },
  "warnings": ["Validate market size figures before relying on them"]
}
```

`assumptions` is required. A response without it fails validation — this is how PRD
section 7 is enforced rather than merely requested.

`business-plan` additionally supports `GET .../export?format=pdf|docx` and returns a
`share_token` for the shareable link.

---

## 11. Notifications and email

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/notifications` | Caller's, unread first, cursor paginated |
| `PATCH` | `/api/notifications/:id/read` | |
| `POST` | `/api/notifications/read-all` | |
| `POST` | `/api/email/send` | Internal only. Requires the service role; never exposed to a client |

`/api/email/send` is not a public relay. It exists so internal services share one
templated sender, and it rejects any request that does not come from the server.

---

## 12. Public routes

No session. Rate-limited by IP. These are the PRD's customer-facing surface.

| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/public/track/:orderNumber` | Requires matching email, or a valid signed token |
| `GET` | `/api/public/plans/:shareToken` | Shared business plan, read-only |
| `POST` | `/api/public/contact` | Contact form, ZeptoMail to the studio |

`/api/public/track` deliberately returns the same 404 whether the order does not exist or
the email does not match, so it cannot be used to test which order numbers are real.

---

## 13. Health

`GET /api/health` — liveness probe. No auth, no database detail in the response.
Database and provider reachability go to logs, not to the client.

---

## 14. Testing notes

- Every route: auth required, non-member 403, validation 400
- Money: no route accepts a float amount
- AI: `assumptions` present in every mocked response, or the route must return 422
- Public routes: identical response shape for "not found" and "wrong email"
