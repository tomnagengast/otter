# otter basic example

End-to-end demo showing how loaders extract data from multiple sources (Postgres + ClickHouse)
into a unified analytics database, with staging models and a combined activity view.

## Architecture

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Sources                                                                        │
├────────────────────────────────────────────────────────────────────────────────┤
│  postgres:5432/postgres            clickhouse:8123/default                     │
│  ├── customers                     └── events                                  │
│  └── orders                                                                    │
└──────────────────────┬──────────────────────────────────────┬──────────────────┘
                       │ otter load                           │
                       ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ Target: analytics:5433/analytics  (schema: analytics)                          │
├────────────────────────────────────────────────────────────────────────────────┤
│ raw_postgres_customers   raw_postgres_orders   raw_clickhouse_events           │
└──────────────────────┬──────────────────────────────────────┬──────────────────┘
                       │ otter build                          │
                       ▼                                      ▼
┌────────────────────────────────────────────────────────────────────────────────┐
│ analytics schema (same db)                                                     │
├────────────────────────────────────────────────────────────────────────────────┤
│ staging/                                                                       │
│   stg_postgres_customers (view)                                                │
│   stg_postgres_orders (view)                                                   │
│   stg_clickhouse_events (view)                                                 │
│                                                                                │
│ mart/                                                                          │
│   customers (table)             ← refs stg_postgres_customers                  │
│   customer_order_counts (view)  ← refs customers + stg_postgres_orders         │
│   customer_activity (table)     ← refs customers + orders + events             │
└────────────────────────────────────────────────────────────────────────────────┘
```

## Layout

```
examples/basic/
├── otter.config.ts              # profiles + sources + models/seeds dirs
├── models/
│   ├── staging/
│   │   ├── stg_postgres_customers.sql
│   │   ├── stg_postgres_orders.sql
│   │   └── stg_clickhouse_events.sql
│   ├── mart/
│   │   ├── customers.sql
│   │   ├── customer_order_counts.sql
│   │   └── customer_activity.sql
└── seeds/                       # (optional CSV seeds, not used in loader demo)
```

## Prerequisites

- Bun 1.3+
- Docker

## 1. Start the databases

From the repo root:

```bash
bun test:up
```

This starts three services:

- `postgres:5432` — **Source** Postgres with `customers` + `orders` tables (preloaded via
  `scripts/init-postgres.sql`)
- `analytics:5433` — **Target** Postgres for landed raw data + built models
- `clickhouse:8123` — **Source** ClickHouse with an `events` table (preloaded via
  `scripts/init-clickhouse.sql`)

## 2. Load source data into the analytics database

From `examples/basic/`:

```bash
cd examples/basic

# Run every loader discovered from source() references in the models.
bun cli load --strategy replace
```

Or target a single stream:

```bash
# postgres.customers → analytics.raw_postgres_customers
bun cli load postgres.customers --strategy replace

# postgres.orders → analytics.raw_postgres_orders
bun cli load postgres.orders --strategy replace

# clickhouse.events (database: default) → analytics.raw_clickhouse_events
bun cli load clickhouse.events --strategy replace
```

Each `otter load <source>.<stream>` command lands rows into
`<target.schema>.raw_<source>_<stream>`. With `target.schema = "analytics"` (set in
`otter.config.ts`), all raw tables share the analytics schema.

When the positional is omitted, `otter load` compiles the project, collects
unique `source(<name>, <stream>)` references across every model, and runs each
one with the same `--strategy` and `--unique-key` flags.

## 3. Compile and build models

```bash
# Compile models into .otter/target/manifest.json
bun cli compile

# Execute the DAG (creates views + tables in analytics schema)
bun cli build

# Preview the unified customer activity
bun cli show customer_activity
```

Expected output from `show customer_activity`:

```
customer_id | name    | email               | order_count | total_spent | event_count | page_views | clicks | purchases
------------+---------+---------------------+-------------+-------------+-------------+------------+--------+----------
1           | Alice   | alice@example.com   | 2           | 150.00      | 4           | 2          | 1      | 1
2           | Bob     | bob@example.com     | 3           | 400.00      | 4           | 2          | 1      | 1
3           | Charlie | charlie@example.com | 1           | 300.00      | 3           | 2          | 1      | 0
4           | Diana   | diana@example.com   | 1           | 50.00       | 3           | 2          | 0      | 0
```

## 4. Explore

```bash
# List all models (topo order)
bun cli list models

# List configured sources
bun cli list sources

# Run only customer_activity and its ancestors
bun cli build -s +customer_activity

# Reset compiled artifacts
bun cli clean
```

## How loaders work

1. `otter load <source>.<stream>` resolves `<source>` against `sources` in
   `otter.config.ts`, opens the source driver (`@otter/source-postgres` or
   `@otter/source-clickhouse`), extracts rows, and writes them to
   `<target.schema>.raw_<source>_<stream>` via the target adapter.

2. Staging models reference raw tables with `{{ source(...) }}`:

   ```sql
   select * from {{ source("postgres", "customers") }}
   ```

   `{{ source("postgres", "customers") }}` compiles to the identifier
   `"raw_postgres_customers"`. The postgres adapter sets `search_path` to the
   target schema during `execute`, so the unqualified identifier resolves to
   `analytics.raw_postgres_customers`.

3. Downstream models reference compiled models with `{{ ref(...) }}`. Model IDs are the
   filename without the `.sql` extension — subdirectories under `models/` are
   for organization and don't affect the ID:

   ```sql
   -- models/staging/stg_postgres_customers.sql
   -- → id: stg_postgres_customers

   select * from {{ ref("stg_postgres_customers") }}
   ```

4. `customer_activity` fans in `stg_postgres_orders` and `stg_clickhouse_events`
   and joins them onto `customers` to produce a single denormalized table.

## Load strategies

- `--strategy replace` — drop + recreate the raw table (default for initial loads)
- `--strategy append` — insert new rows (good for simple incremental loads)
- `--strategy merge --unique-key id` — upsert by unique key (dedupes)
