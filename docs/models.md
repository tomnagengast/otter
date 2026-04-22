# Models

Otter models are `.sql` files with a lightweight `{{ ... }}` templating layer. Each file contains a
SQL body with optional calls to `config`, `ref`, `source`, and `seed`.

## Table of Contents

- [File Layout](#file-layout)
- [Model API](#model-api)
- [Materializations](#materializations)
- [Dependencies and DAG](#dependencies-and-dag)
- [Example](#example)

## File Layout

Models live under `modelsDir` (configured in [configuration.md](configuration.md)). Every file
matching `modelsDir/**/*.sql` is a model.

The **model id** is the filename with the `.sql` suffix stripped. Subdirectories under `modelsDir`
are for organization and do not affect the id. For example, `models/staging/stg_users.sql` has
id `stg_users`.

```
models/
├── stg_users.sql        # id: stg_users
├── dim_users.sql        # id: dim_users
└── fct/
    └── fct_events.sql   # id: fct_events
```

## Model API

Models use four templating calls, all wrapped in `{{ ... }}`.

### `{{ config(...) }}`

```sql
{{ config(
  materialized: "incremental",
  unique_key: "id",
  tags: ["nightly"]
) }}
```

Zero or one `config` block per model. The body is a JavaScript object literal (unquoted keys,
trailing commas, `//` comments all fine). The block is stripped from the compiled SQL.

| Field          | Type                                 | Default | Description                                 |
| -------------- | ------------------------------------ | ------- | ------------------------------------------- |
| `materialized` | `"view" \| "table" \| "incremental"` | `view`  | Build strategy for the model                |
| `unique_key`   | `string`                             | —       | Required when `materialized: "incremental"` |
| `tags`         | `string[]`                           | —       | Labels used by selectors (`tag:<name>`)     |

### `{{ ref("name") }}`

```sql
select * from {{ ref("stg_users") }}
```

Records a DAG edge `stg_users → <current model>` and expands to a double-quoted identifier
(`"stg_users"`). The adapter resolves the identifier against the target schema at execution time.

### `{{ source("name", "stream") }}`

```sql
select * from {{ source("stripe_pg", "charges") }}
```

Records the pair as a raw-table dependency and expands to `"raw_stripe_pg_charges"`. The actual
raw table is produced by `otter load stripe_pg.charges`; see [cli.md](cli.md#load).

### `{{ seed("name") }}`

```sql
select * from {{ seed("countries") }}
```

Records a seed dependency and expands to `"seed_countries"`. Seed CSVs are loaded from `seedsDir`
by `otter build --seed`.

## Materializations

Otter supports three materializations: `view`, `table`, and `incremental`. See
[materializations.md](materializations.md) for semantics, swap behavior, and the incremental
predicate helper.

## Dependencies and DAG

Every `{{ ref(...) }}`, `{{ source(...) }}`, and `{{ seed(...) }}` call is recorded during
`otter compile`. The compiler assembles a DAG, topologically sorts it, and writes
`.otter/target/manifest.json`.

- Cycles cause `otter compile` to fail.
- A `ref` to a non-existent model id is reported at compile time.
- A `source` pair that does not match a `config.sources` entry is reported at compile time.

See [cli.md](cli.md#compile) and [state.md](state.md#manifest) for the manifest format.

## Example

A three-model project showing the most common patterns.

```sql
-- models/stg_users.sql
{{ config(
  materialized: "table"
) }}

select id, email, created_at
from {{ source("stripe_pg", "users") }}
```

```sql
-- models/dim_users.sql
{{ config(
  materialized: "view",
  tags: ["public"]
) }}

select id, lower(email) as email, created_at
from {{ ref("stg_users") }}
```

```sql
-- models/fct_events.sql
{{ config(
  materialized: "incremental",
  unique_key: "event_id",
  tags: ["nightly"]
) }}

select event_id, user_id, occurred_at, payload
from {{ ref("stg_events") }}
```

Build the whole project with `otter compile && otter build`, or select `dim_users` and its
ancestors with `otter build -s +dim_users`. See [selectors.md](selectors.md).
