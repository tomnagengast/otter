# Materializations

A materialization describes how a model's compiled SQL is turned into a database object. Otter
supports three: `view`, `table`, and `incremental`.

## Table of Contents

- [view](#view)
- [table](#table)
- [incremental](#incremental)
- [Swap Semantics](#swap-semantics)
- [Example](#example)

## `view`

```sql
{{ config(
  materialized: "view"
) }}
```

The default. Executes `CREATE OR REPLACE VIEW "<schema>"."<model>" AS <compiled SQL>`. No staging,
no swap — the view is rewritten in place on every run.

Use for:

- Cheap transformations whose freshness matches the underlying data.
- Models that sit on small source tables.

## `table`

```sql
{{ config(
  materialized: "table"
) }}
```

Builds a staging table, then atomically swaps it into the final name:

1. `CREATE TABLE "<schema>"."<model>__stg" AS <compiled SQL>`
2. `swap(staging, final)` — see [Swap Semantics](#swap-semantics).

Readers of the final table never observe a missing or empty result — the swap happens inside a
single transaction.

Use for:

- Expensive transformations you want to freeze until the next build.
- Full refreshes over small-to-medium datasets.

## `incremental`

```sql
{{ config(
  materialized: "incremental",
  unique_key: "event_id"
) }}
```

Requires the adapter to implement `mergeIncremental`. If it does not, the build fails with
`<kind> adapter does not support incremental materialization`.

Runtime contract (Postgres adapter):

1. Build a staging table from the compiled SQL.
2. Ensure the final table exists with the same columns (`CREATE TABLE IF NOT EXISTS … WHERE FALSE`).
3. Ensure a unique index on `unique_key`.
4. `INSERT … ON CONFLICT (unique_key) DO UPDATE SET …` from staging into final.
5. Drop staging.

`unique_key` is mandatory — the build raises `${id}: incremental requires unique_key` if omitted.

Use for:

- Append-heavy fact tables where full refresh is too expensive.
- Slowly-changing dimensions keyed by a stable id.

See [adapter-postgres.md](adapter-postgres.md#materialization-semantics) for the Postgres-specific
SQL.

## Swap Semantics

For `table` materializations, the runner calls `adapter.swap(staging, final)` after the staging
table is populated. The Postgres adapter implements it as:

```sql
BEGIN;
DROP TABLE IF EXISTS "<schema>"."<final>__old__otter" CASCADE;
ALTER TABLE IF EXISTS "<schema>"."<final>" RENAME TO "<final>__old__otter";
ALTER TABLE "<schema>"."<staging>" RENAME TO "<final>";
DROP TABLE IF EXISTS "<schema>"."<final>__old__otter" CASCADE;
COMMIT;
```

The leading drop clears any stray `__old__otter` left by a prior failed swap. The rename-first
step avoids Postgres catalog collisions when replacing an existing table with a same-named
staging table inside one transaction. The whole swap is still single-transaction: a concurrent
reader either sees the old table or the new table, never neither.

## Example

```sql
-- models/stg_events.sql
{{ config(
  materialized: "table"
) }}

select * from {{ source("events_ch", "events") }}
```

```sql
-- models/fct_events.sql
{{ config(
  materialized: "incremental",
  unique_key: "event_id"
) }}

select event_id, user_id, occurred_at from {{ ref("stg_events") }}
```

```sql
-- models/rpt_events.sql
{{ config(
  materialized: "view"
) }}

select user_id, count(*) as n from {{ ref("fct_events") }} group by user_id
```

Related: [models.md](models.md#model-api), [adapter-postgres.md](adapter-postgres.md),
[state.md](state.md#cursors).
