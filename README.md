# Qubators Business Studio

**AI-powered business creation and growth platform.** From idea to a structured, branded,
market-ready business — then a workspace to keep operating it.

> IDEA + AI + BUSINESS TOOLS + EXECUTION = QUBATORS

Target market: **Uganda → East Africa → Africa → Global**

---

## Status

**Pre-implementation. No application code yet.**

| Milestone | State |
|---|---|
| Product requirements | ✅ [`docs/PRD.md`](docs/PRD.md) v1.0 |
| Architecture | ✅ [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) |
| Database design | ✅ [`docs/DATABASE.md`](docs/DATABASE.md) |
| API contract | ✅ [`docs/API.md`](docs/API.md) |
| Decision log | ✅ [`docs/DECISIONS.md`](docs/DECISIONS.md) |
| Foundation scaffolding | ⬜ next |
| Authentication | ⬜ |
| AI engine | ⬜ |

Open blockers are listed in [DECISIONS.md](docs/DECISIONS.md#open-questions): the LLM
provider, the Supabase project, a sending domain for ZeptoMail, and the licence.

---

## Modules

Planned, in MVP order:

1. **Authentication** — register, verify, login, reset
2. **Dashboard** — progress, revenue, customers, tasks, AI recommendations
3. **Business Engine** — business creation, profile, products, services, customers
4. **AI Engine** — Copilot, idea generator, business plan, brand, marketing copy
5. **Business Management** — finance, tasks, analytics, campaigns
6. **Communications** — ZeptoMail transactional email
7. **Production** — testing, security, performance, deployment

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | PostgreSQL — Supabase |
| Auth | Supabase Auth |
| AI | Provider-agnostic adapter — see [ADR-3](docs/DECISIONS.md#adr-3-ai-provider) |
| Email | ZeptoMail |
| Hosting | Vercel |

---

## Getting started

### Prerequisites

- **Node.js 20 LTS** — `node --version` should print `v20.x`
- **Git** — for clone and commits
- A **Supabase project** — database, auth and storage
- An **LLM API key** — for the AI engine
- A **domain you control** — required before ZeptoMail can send

### Setup

```bash
git clone https://github.com/malaikahero33-ctrl/QubatorsBuisnessStudio.git
cd QubatorsBuisnessStudio

npm install
cp .env.example .env.local     # then fill in the real values
npm run dev                    # http://localhost:3000
```

### Environment

`.env.example` lists every variable **name** with no values. Copy it to `.env.local`,
which is git-ignored, and fill it in.

**Secrets never go in the repository.** The Supabase service-role key and the ZeptoMail
token are server-side only — never a `NEXT_PUBLIC_*` variable, never committed. This is
PRD section 15 and it is the single most important rule in this codebase.

### Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | Lint, including architecture boundary rules |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | Unit and integration tests |
| `db:push` | Apply database migrations |

---

## Project structure

```
.
├── app/                 routes and route handlers
├── components/          presentational only — no data fetching
├── lib/
│   ├── ai/              provider adapter, prompts, context, cost guard
│   ├── auth/            session and membership checks
│   ├── database/        typed queries
│   ├── email/           ZeptoMail client and templates
│   ├── money.ts         the only place money is formatted
│   └── validation/      Zod schemas
├── database/migrations/ numbered SQL
├── docs/                PRD and design documents
├── archive/             superseded work — reference only
└── tests/
```

---

## Conventions worth knowing

**Money is an integer.** Every amount is `*_minor` (integer, minor units) with a `currency`
ISO 4217 code alongside. No floats, no symbols in the database. UGX is a zero-decimal
currency, so `10000` means ten thousand shillings. Format only in `lib/money.ts`.

**AI states its assumptions.** Every generative response carries an `assumptions` array. A
response without one fails validation rather than being shown as fact. The AI must never
guarantee profit, and must distinguish its suggestions from verified market research.

**Components do not query the database.** Data is fetched in Server Components or route
handlers. Enforced by lint rules — see [ARCHITECTURE.md §5](docs/ARCHITECTURE.md#5-module-boundaries).

**One business at a time is active.** Every read and write is scoped to the active
`business_id`. Row-level security enforces it at the database, not just in application
code.

---

## Contributing

Branch from `main`, one feature per branch, open a pull request. Vercel gives every PR a
preview URL. See [ARCHITECTURE.md §10](docs/ARCHITECTURE.md#10-deployment).

**Before opening a PR:** `npm run lint && npm run typecheck && npm test`.

If you change an architecture decision, add an ADR to
[docs/DECISIONS.md](docs/DECISIONS.md). If you change the schema, add a new migration —
never edit an applied one.

---

## Archive

`archive/legacy-prototype/` holds an earlier prototype built to a different brief — a
design-studio operations tool. It is **not** an implementation of this PRD and is kept
only for its CSS design system. See
[`archive/legacy-prototype/ARCHIVE-NOTES.md`](archive/legacy-prototype/ARCHIVE-NOTES.md).

---

## Licence

[MIT](LICENSE) — **placeholder, not yet confirmed.** Do not distribute until settled.
