# Qubators Business Studio

A working front-end for a design studio: **design**, **consultations**, **orders**, and a
**customer journey** page where buyers track their own order. Plus a **business account**
with profile, business details, login and security.

No build step, no dependencies — plain HTML, CSS and JavaScript.

---

## Run it

**Option 1 — double-click `index.html`.**
It also runs straight from the file system.

**Option 2 — local server (recommended).** In PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-studio.ps1
```

Then open <http://localhost:8765/>

The launcher prints a "Press Ctrl+C to stop" message. Close that window to stop the server.

### Demo sign-in

| | |
|---|---|
| Email | `owner@qubators.studio` (any email works) |
| Password | any 4+ characters |

To view the customer side without signing in, open <http://localhost:8765/#/track>
and track demo order `QB-1041`.

---

## The three areas

### 1. Customer journey — `#/track`

The public face of the studio. A customer types their order number and gets:

- a six-stage progress rail: Received → Designing → Production → Quality Check → Dispatched → Delivered
- the step they are on, with a dated activity trail for completed steps
- order details (placed date, quantity, total, studio owner) and expected delivery
- a contact-the-studio link that opens a pre-filled email

Each order has its own shareable link: `#/track/QB-1041`. Copy it from the order
detail page or the customer's confirmation email. A wrong number shows a helpful
"not found" state instead of a blank page.

### 2. Business account — `#/account`

Four tabs:

- **Profile** — name, role, email, phone, timezone, bio, avatar
- **Business** — studio name, location, brand colour, notification preferences, and
  the public tracking link to hand out
- **Login & security** — password change with a live strength meter, two-factor
  setup with a scannable code, and active sessions with per-device sign-out
- **Team** — who can see orders and designs, with invitations

### 3. Design, consultations and orders

- **Dashboard** `#/dashboard` — KPIs, order pipeline funnel, upcoming consultations,
  recent orders and a studio activity feed
- **Orders** `#/orders` — searchable and filterable list, CSV export, create orders,
  and a detail page where you move a job through its stages (which is exactly what
  the customer sees update on their tracking page)
- **Designs** `#/designs` — gallery of projects, filterable by category, and a
  **built-in canvas editor**: draw, line, box, circle, text and fill, with colour
  swatches, brush size, undo, PNG export and saving the sketch back to the project
- **Consultations** `#/consultations` — upcoming and past sessions, booking, and
  marking a call complete
- **Customers** `#/customers` — customer list with lifetime value and export

---

## Files

```
index.html                 page shell and script tags
start-studio.ps1           tiny local server (no Node or Python needed)
assets/css/styles.css      full design system, light and dark
assets/js/data.js          store: seed data, localStorage, session
assets/js/ui.js            shared helpers: icons, formatting, modal, toast, forms
assets/js/views-core.js    dashboard, orders, order detail, customers, customer tracking
assets/js/views-more.js    designs, canvas editor, consultations, account, login
assets/js/app.js           shell, sidebar, router, theme, popovers
```

Routes are hash based, so any page can be linked or bookmarked directly.

---

## How the data works

Everything is **local-first**: `data.js` seeds a demo studio on first run and saves
every change to `localStorage` under `qb_studio_data_v1`. The signed-in session lives in
`sessionStorage`. Nothing leaves the browser.

To go back to the original demo data, use **Account → Login & security → Reset demo data**.

### Wiring it to a real backend

`QB.store` is the only module that touches data, and it is the only one you need to
replace. Keep the same shape and every view keeps working:

```js
QB.store.orders.all()
QB.store.orders.byId(id)
QB.store.orders.add({ customer, item, qty, total, due, ... })
QB.store.orders.setStage(id, stageIndex)   // 0-5, drives the customer journey
QB.store.designs.all() / byId(id) / add() / update() / remove()
QB.store.consults.all() / upcoming() / past() / add() / setStatus()
QB.store.account.get() / update(patch)
QB.store.misc.stats() / activity() / users()
```

Swap the `load()` / `save()` pair in `data.js` for `fetch()` calls against your API and
the rest of the app is unchanged. For real authentication, replace `QB.store.auth`
(the current one is a demo that accepts any credentials) and keep returning a session
object — the router already guards every non-public route.

---

## Notes

- Light and dark theme, remembered per browser; follows your system setting by default
- Responsive down to phone width, with a slide-out sidebar
- Keyboard and screen-reader friendly: labelled fields, inline validation, `Esc` closes dialogs
- No external libraries, and **no external requests at all** - the app runs fully offline on
  your system fonts (Segoe UI on Windows), so nothing is fetched from the internet
