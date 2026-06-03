# AasaMedChem — Inventory & Order Management

A small but production-shaped inventory and order-management system for a
chemicals/lab-supplies business. It handles **multi-unit products** (weight,
volume, count), **unit-aware INR pricing**, role-based access for **Admin** and
**Seller** users, and a full **search → quotation/order → admin review** flow.

> Built with **Next.js 15 (App Router)**, **Neon PostgreSQL**, **Drizzle ORM**,
> **Tailwind CSS**, and deployed on **Vercel**.

---

## Table of contents

1. [Features](#features)
2. [Tech stack & system design](#tech-stack--system-design)
3. [Unit storage & conversion strategy](#unit-storage--conversion-strategy) ⭐
4. [Price & quantity storage (types, precision, rounding)](#price--quantity-storage-types-precision-rounding)
5. [Database schema](#database-schema)
6. [Local setup](#local-setup)
7. [Connecting to Neon](#connecting-to-neon)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Test credentials & how to use each panel](#test-credentials--how-to-use-each-panel)
10. [Design decisions & assumptions](#design-decisions--assumptions)

---

## Features

**Admin**
- Create / update / delete products; configure dimension, **base unit**, **base price**, and stock.
- Inventory view with friendly-unit stock levels, low-stock flags, and total stock value.
- Review incoming quotations/orders with a **per-line conversion breakdown** (ordered qty → base qty → rate → line total) so pricing is auditable.
- Update order status; confirming an order **deducts stock** (idempotently, in a transaction).

**Seller (the buyer who places orders)**
- Browse / search / filter products (by text, dimension, category).
- Enter quantity in **any supported unit** and see the **live INR price** instantly.
- Build a quotation/order cart with editable lines and a running total.
- Track personal orders and their status.

**Cross-cutting**
- JWT cookie auth + bcrypt password hashing; role-based route guards via middleware.
- All pricing is **recomputed server-side** on submit — client totals are never trusted.
- INR formatting via `Intl.NumberFormat('en-IN')`.

---

## Tech stack & system design

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components for data fetching + Route Handlers for the API in one codebase; first-class Vercel deploy. |
| Database | Neon PostgreSQL (serverless) | Managed Postgres with branching; pooled endpoint suits serverless functions. |
| ORM | Drizzle ORM | Type-safe, SQL-close, lightweight; explicit control over `NUMERIC` columns. |
| Driver | `postgres` (postgres-js) | One driver path that works for **local Postgres** *and* **Neon's pooled connection string**. |
| Auth | `jose` (JWT) + `bcryptjs` | `jose` runs in the Edge runtime (middleware); bcrypt runs in the Node runtime (route handlers). |
| Money math | `decimal.js` | Avoids JavaScript floating-point error in financial calculations. |
| Validation | `zod` | Schema validation for all API inputs. |
| UI | Tailwind CSS | Fast, consistent, responsive admin/seller panels. |

### How the pieces interact

```
Browser (React Server + Client Components)
        │
        │  fetch() for mutations            Server Components read directly
        ▼                                   via Drizzle (no internal HTTP hop)
Next.js Route Handlers  ──────────────►  Drizzle ORM  ──────────►  Neon Postgres
 (/api/auth, /api/products, /api/orders)   (postgres-js driver)      (NUMERIC storage)
        ▲
        │  middleware.ts (Edge) verifies the JWT cookie and enforces
        │  role-based access before any /admin/* or /seller/* route renders.
```

- **Reads** (lists, detail pages) happen in **Server Components** calling Drizzle directly — fewer round-trips, no client-exposed data layer.
- **Writes** (login, product CRUD, placing/updating orders) go through **Route Handlers** under `/api`, which re-validate input (`zod`), re-check the session/role, and **recompute pricing** before writing.
- **Conversions** live in one isomorphic module (`src/lib/units.ts`) used by the seed script, the API, and the UI — a single source of truth.

### Project layout

```
src/
  app/
    api/                # Route Handlers (auth, products, orders)
    admin/              # Admin panel (products, inventory, orders)
    seller/             # Seller panel (storefront, my orders)
    login/              # Login page
  components/           # Shell, nav, order card, status badge, logout
  db/
    schema.ts           # Drizzle schema (source of truth for tables)
    index.ts            # DB client
    migrate.ts          # Migration runner
    seed.ts             # Demo data + test users
  lib/
    units.ts            # ⭐ unit catalogue + all conversion/pricing math
    auth.ts             # Node-runtime auth (bcrypt, session cookie)
    jwt.ts              # Edge-compatible JWT sign/verify
    validation.ts       # zod input schemas
  middleware.ts         # Role-based route guard (Edge)
drizzle/                # Generated SQL migrations
```

---

## Unit storage & conversion strategy

This is the core of the system. The full implementation is in
[`src/lib/units.ts`](src/lib/units.ts).

### 1. One canonical base unit per dimension

Every product has a **dimension**, and each dimension stores quantities in a
single canonical **base unit**:

| Dimension | Base unit (stored) | Accepted input/display units |
|-----------|--------------------|------------------------------|
| `weight`  | **gram (g)**        | g, kg |
| `volume`  | **millilitre (mL)** | mL, L |
| `count`   | **item**            | item |

Storing everything in one base unit per dimension means quantities are directly
comparable and summable, and **price math is uniform** regardless of the unit a
user typed.

### 2. Conversion factors

A `units` reference table stores `factor_to_base` for each unit, so conversions
are **data-driven**, not hardcoded:

```
base_qty = entered_qty × factor_to_base

g  → 1        kg → 1000        (1 kg  = 1000 g)
mL → 1        L  → 1000        (1 L   = 1000 mL)
item → 1
```

### 3. Prices are stored per base unit

`products.base_price` = **INR per ONE base unit** (e.g. INR per gram). When an
admin types a friendlier rate like "₹850 per kg", we normalise on save:

```
base_price = price_per_display_unit ÷ factor_to_base(display_unit)
           = 850 ÷ 1000 = 0.85   (₹/g)
```

### 4. Where conversions are applied

| Stage | What happens | Code |
|-------|--------------|------|
| **Before save** (admin form) | display-unit price → per-base-unit price; entered stock → base units | `pricePerDisplayUnitToBase`, `toBase` |
| **During calculation** (placing an order) | `base_qty = ordered_qty × factor_to_base`; `line_total = base_qty × base_price` | `calcLineTotal` |
| **Before display** (UI) | base values → friendly unit; numbers → INR strings | `fromBase`, `basePriceToDisplayUnit`, `formatINR` |

### 5. Worked example (verified end-to-end)

> Order **1.5 kg** of Sodium Chloride priced at **₹850/kg** (stored as ₹0.85/g):
> `1.5 kg × 1000 = 1500 g`, then `1500 g × ₹0.85/g = ₹1275.00`.

The UI shows the live total as you type; the server **recomputes** the same value
from the DB on submit, so a tampered client payload cannot change the price.

---

## Price & quantity storage (types, precision, rounding)

All money/quantity columns use PostgreSQL **`NUMERIC`** (arbitrary-precision
decimal), never `float`/`double`, so there is **no IEEE-754 binary rounding
drift** in financial math.

| Concern | Column(s) | Type | Rationale |
|---------|-----------|------|-----------|
| Quantities & factors | `stock_base_qty`, `ordered_qty`, `base_qty`, `factor_to_base` | `NUMERIC(20, 6)` | High decimal precision (6 dp) for fine-grained amounts; 14 integer digits handle very large stock. |
| Per-unit rates | `base_price`, `unit_price_base` | `NUMERIC(20, 6)` | Per-**base**-unit rates get small (e.g. ₹0.025/mL), so extra fractional precision matters. |
| Money totals | `line_total`, `orders.total` | `NUMERIC(20, 2)` | INR rounded to paise (2 dp). |

**Scaling / rounding rules**
- Internally we keep full precision; we only **round at the money boundary**
  (line totals and grand totals) to **2 dp** using `ROUND_HALF_UP` via
  `decimal.js`.
- Quantities are stored at up to 6 dp; the UI trims trailing zeros for display.
- Across the wire, decimals are passed as **strings** (not JS numbers) to
  preserve precision; Drizzle reads/writes `NUMERIC` as strings as well.
- `decimal.js` is configured with `precision: 40` for intermediate math.

---

## Database schema

Source of truth: [`src/db/schema.ts`](src/db/schema.ts). Generated SQL lives in
[`drizzle/`](drizzle/).

### `users`
| Column | Type | Notes |
|---|---|---|
| id | `uuid` PK | `defaultRandom()` |
| email | `text` unique | |
| password_hash | `text` | bcrypt hash |
| name | `text` | |
| role | `enum('admin','seller')` | default `seller` |
| created_at | `timestamptz` | |

### `categories`
| Column | Type | Notes |
|---|---|---|
| id | `uuid` PK | |
| name | `text` | |
| slug | `text` unique | |

### `units` (reference data)
| Column | Type | Notes |
|---|---|---|
| code | `text` PK | `g`, `kg`, `mL`, `L`, `item` |
| label | `text` | human label |
| dimension | `enum('weight','volume','count')` | |
| factor_to_base | `NUMERIC(20,6)` | multiplier to base unit |

### `products`
| Column | Type | Notes |
|---|---|---|
| id | `uuid` PK | |
| sku | `text` unique | |
| name | `text` | |
| description | `text` null | |
| category_id | `uuid` FK → categories | `on delete set null` |
| dimension | `enum` | weight/volume/count |
| base_unit | `text` FK → units.code | derived from dimension |
| base_price | `NUMERIC(20,6)` | **INR per base unit** |
| stock_base_qty | `NUMERIC(20,6)` | stock in **base units** |
| is_active | `boolean` | sellers see active only |
| created_at / updated_at | `timestamptz` | |

### `orders`
| Column | Type | Notes |
|---|---|---|
| id | `uuid` PK | |
| user_id | `uuid` FK → users | `on delete cascade` |
| type | `enum('quotation','order')` | |
| status | `enum('pending','quoted','confirmed','rejected','fulfilled')` | default `pending` |
| total | `NUMERIC(20,2)` | grand total snapshot (INR) |
| note | `text` null | |
| created_at / updated_at | `timestamptz` | |

### `order_items`
| Column | Type | Notes |
|---|---|---|
| id | `uuid` PK | |
| order_id | `uuid` FK → orders | `on delete cascade` |
| product_id | `uuid` FK → products | |
| ordered_qty | `NUMERIC(20,6)` | as the user entered it |
| ordered_unit | `text` FK → units.code | the unit the user chose |
| base_qty | `NUMERIC(20,6)` | converted to base unit |
| unit_price_base | `NUMERIC(20,6)` | **snapshot** of base_price at order time |
| line_total | `NUMERIC(20,2)` | base_qty × unit_price_base |
| product_name / product_sku | `text` | display snapshots |

> **Why snapshots?** `order_items` records the price/name **at order time**, so a
> later admin price edit never rewrites historical orders.

---

## Local setup

**Prerequisites:** Node 18.18+ and a PostgreSQL instance (local or Neon).

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env.local
#   then edit .env.local:
#   DATABASE_URL="postgres://USER@localhost:5432/aasamed_dev"
#   AUTH_SECRET="<output of: openssl rand -base64 32>"

# 3. Create the database (local Postgres)
createdb aasamed_dev

# 4. Generate + apply migrations
npm run db:generate     # (already committed; regenerates SQL from schema)
npm run db:migrate      # applies SQL in ./drizzle to DATABASE_URL

# 5. Seed demo data (users, products, orders)
npm run db:seed

# 6. Run
npm run dev             # http://localhost:3000
```

### npm scripts
| Script | Purpose |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run db:generate` | Generate SQL migrations from `schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:push` | Push schema directly (no migration file) |
| `npm run db:seed` | Reset & seed demo data |
| `npm run db:studio` | Open Drizzle Studio |

---

## Connecting to Neon

1. Create a project at [neon.tech](https://neon.tech) and a database (e.g. `neondb`).
2. From the Neon dashboard, copy the **Pooled connection** string (host contains
   `-pooler`) — this is the right one for serverless/Vercel:
   ```
   postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/neondb?sslmode=require
   ```
3. Put it in `.env.local` (local) and/or Vercel env vars (production) as
   `DATABASE_URL`. The DB client auto-enables SSL for `neon.tech` hosts.
4. Apply the schema and seed against Neon:
   ```bash
   DATABASE_URL="<neon-pooled-url>" npm run db:migrate
   DATABASE_URL="<neon-pooled-url>" npm run db:seed
   ```

> Tip: Neon **branching** lets you keep a separate dev branch URL for local work
> and the primary branch for production.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. In Vercel: **New Project → Import** the repo (framework auto-detected as Next.js).
3. Add **Environment Variables** (Production + Preview):
   - `DATABASE_URL` → your Neon **pooled** connection string
   - `AUTH_SECRET` → a long random string (`openssl rand -base64 32`)
4. **Deploy.** Vercel runs `next build` automatically.
5. One-time database init (from your machine, pointing at Neon):
   ```bash
   DATABASE_URL="<neon-pooled-url>" npm run db:migrate
   DATABASE_URL="<neon-pooled-url>" npm run db:seed
   ```
6. **Re-deploy:** push to the default branch (or click *Redeploy*). Schema
   changes: run `npm run db:generate`, commit the new SQL in `drizzle/`, then
   `npm run db:migrate` against Neon.

---

## Test credentials & how to use each panel

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@aasamed.com` | `Admin@123` |
| **Seller (buyer)** | `seller@aasamed.com` | `Seller@123` |

### Admin panel (`/admin`)
- **Products** — add/edit/delete. Pick a *dimension*; enter the price **per a
  unit you choose** (e.g. ₹850 per kg) and stock in any unit — both are
  normalised to base units on save.
- **Inventory** — current stock in friendly units, low-stock flags, total value.
- **Orders** — every quotation/order with a full conversion breakdown. Change
  **status**; setting it to **confirmed** deducts stock.

### Seller panel (`/seller`)
- **Browse** — search by name/SKU, filter by dimension/category. For each
  product, choose a **unit**, type a **quantity**, and watch the **INR line
  price** update live. Click **Add** to put it in the cart.
- The cart shows editable lines and a grand total. Choose **Quotation** or
  **Order**, add an optional note, and **place** it.
- **My Orders** — your submissions and their current status.

### Try the conversion flow
1. Log in as **seller**, add **1.5 kg** Sodium Chloride and **2 L** Acetone, place an order.
2. Log in as **admin**, open **Orders**, verify the per-line math, set the order
   to **confirmed**, then check **Inventory** — stock has dropped by exactly the
   converted base quantities.

---

## Design decisions & assumptions

- **Quotation and order share one table** (`orders.type`). They follow the same
  flow; an admin moves a quotation toward fulfilment via status. This keeps the
  model simple while supporting both intents.
- **Status model:** `pending → quoted → confirmed → rejected → fulfilled`. Stock
  is deducted when an order **becomes** `confirmed` (once, transactionally and
  idempotently).
- **Role terminology:** the non-admin role is `seller` in code/DB, but it is the
  **buyer** in the ordering flow (browses and places orders).
- **Server-authoritative pricing:** the client computes a live preview for UX,
  but the server recomputes every line from current product rows on submit.
- **Soft-delete by deactivation:** products referenced by orders can't be hard-
  deleted (FK protected); deactivate them instead so order history stays intact.
- **Single driver (`postgres-js`)** for both local and Neon to keep one code
  path; on Vercel use Neon's pooled endpoint.
```
