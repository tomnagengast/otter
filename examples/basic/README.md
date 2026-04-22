# otter basic example

End-to-end demo showing how loaders extract data from multiple sources (Postgres + ClickHouse)
into a unified analytics database, with staging models and a combined activity view.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Sources                                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  postgres:5432/postgres         clickhouse:8123/default                      │
│  ├── customers                  └── events                                   │
│  └── orders                                                                  │
└──────────────────────┬──────────────────────────────────────┬───────────────┘
                       │ otter load                           │
                       ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Target: analytics:5433/analytics                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ raw.postgres_customers    raw.postgres_orders    raw.clickhouse_events      │
└──────────────────────┬──────────────────────────────────────┬───────────────┘
                       │ otter build                          │
                       ▼                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ analytics schema                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ staging/                                                                     │
│   stg_postgres_customers (view)                                              │
│   stg_postgres_orders (view)                                                 │
│   stg_clickhouse_events (view)                                               │
│                                                                              │
│ models/                                                                      │
│   customers (table)           ← refs stg_postgres_customers                  │
│   customer_order_counts (view)← refs customers + stg_postgres_orders         │
│   customer_activity (table)   ← refs customers + orders + events             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layout

```
examples/basic/
├── otter.config.ts              # profiles + sources + models/seeds dirs
├── models/
│   ├── staging/
│   │   ├── stg_postgres_customers.sql.ts
│   │   ├── stg_postgres_orders.sql.ts
│   │   └── stg_clickhouse_events.sql.ts
│   ├── customers.sql.ts
│   ├── customer_order_counts.sql.ts
│   └── customer_activity.sql.ts
└── seeds/                       # (optional CSV seeds, not used in loader demo)
```

## Prerequisites

- Bun 1.3+
- Docker

## 1. Start the databases

From the repo root:

```bash
docker compose -f docker-compose.test.yml up -d
```

This starts:

- `postgres:5432` - Source Postgres with customers and orders tables (preloaded)
- `analytics:5433` - Target Postgres for analytics
- `clickhouse:8123` - Source ClickHouse with events table (preloaded)

## 2. Load source data into the analytics database

From `examples/basic/`:

```bash
cd examples/basic

# Load customers from postgres.public.customers → analytics.raw.postgres_customers
bun cli load postgres.customers --strategy replace

# Load orders from postgres.public.orders → analytics.raw.postgres_orders
bun cli load postgres.orders --strategy replace

# Load events from clickhouse.default.events → analytics.raw.clickhouse_events
bun cli load clickhouse.default.events --strategy replace
```

## 3. Compile and build models

```bash
# Compile models into .otter/target/manifest.json
bun cli compile

# Execute the DAG
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
# List all models
bun cli list models

# List all sources
bun cli list sources

# Run only customer_activity and its dependencies
bun cli build -s +customer_activity

# Reset compiled artifacts
bun cli clean
```

## How loaders work

1. `otter load <source>.<stream>` extracts rows from a configured source and loads them
   into the target database under the `raw` schema with naming `<source>_<stream>`.

2. Staging models use `source("postgres", "customers")` to reference the raw loaded tables.
   This resolves to the identifier `raw_postgres_customers`.

3. Downstream models use `ref("staging_stg_postgres_customers")` to depend on staging views.

4. The unified `customer_activity` model combines data from both Postgres (customers, orders)
   and ClickHouse (events) sources into a single denormalized table.

## Load strategies

- `--strategy replace` - Drop and recreate the target table (default for initial loads)
- `--strategy append` - Insert new rows (good for incremental)
- `--strategy merge --unique-key id` - Upsert based on unique key (deduplication)
