# Archived: legacy design-studio prototype

**Status:** Archived, read-only. Not part of the build.
**Archived:** 28 September 2026
**Reason:** Built to an earlier, different brief. Superseded by `docs/PRD.md`.

---

## What this was

A working front-end prototype for a **design studio operations tool** — orders, design
projects, consultations, and a customer-facing order-tracking page. It shares the
**Qubators Business Studio** name with the real product but is a **different product**.

It was never a prototype of the PRD. It predates it and was built to a separate brief.

## Why it was archived

`docs/PRD.md` describes an **AI-powered business creation platform** for African
entrepreneurs (Uganda first): idea → business plan → brand → products → marketing →
customers → finance → analytics → growth.

The prototype covers roughly **3 of 14 PRD modules**, and its local-currency handling is
wrong for the target market — it hard-codes Bangladeshi Taka:

```js
const nf = new Intl.NumberFormat('en-US');
const money = (n) => '৳' + nf.format(Math.round(n || 0));
```

The PRD targets UGX, KES, TZS, RWF, USD, GBP, EUR. See `docs/DATABASE.md` for how money
must be stored instead.

## What is worth keeping

| File | Value |
|---|---|
| `assets/css/styles.css` | **High.** A complete design system — light/dark themes, responsive layout, accessible form and focus states, 30 KB of tokens and components. Reference this when building the Tailwind theme. |
| `assets/js/ui.js` | Medium. Toast, modal, form validation and focus-trap patterns worth porting. |
| `assets/js/app.js` | Medium. Shell, sidebar and router structure — a useful UX reference, wrong stack. |

**Not reusable:** `data.js` (localStorage store, replaced by Supabase) and
`views-*.js` (orders, designs, canvas editor, consultations — none exist in the PRD).

Roughly **15–20% of this prototype's value is its visual design language.** That is why it
is archived rather than discarded.

## Provenance

- Original location: `Documents/Default Project/`
- Original repository commit: `f2f32df` — *"Qubators Business Studio - working prototype"*
- The original folder was left untouched at the time of archiving. Nothing was deleted.
- Copied in without its own `.git` history; the commit hash above is the reference.

## Do not

- Treat this as an implementation of the PRD
- Copy its data model, currency handling, or authentication
- Build on it as a codebase

Reference the design system only.
