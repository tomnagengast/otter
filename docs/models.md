# Models

Otter models are TypeScript files with a `.sql.ts` extension. Each file exports a default `sql`
template as the model body and an optional `config` object describing how it is materialized.

## Table of Contents

- [File Layout](#file-layout)
- [Model API](#model-api)
- [Materializations](#materializations)
- [Dependencies and DAG](#dependencies-and-dag)
- [Example](#example)

## File Layout

Models live under `modelsDir` (configured in [configuration.md](configuration.md)). Every file
matching `modelsDir/**/*.sql.ts` is a model.

The **model id** is the path relative to `modelsDir` with the `.sql.ts` suffix stripped. For
example, `models/staging/stg_users.sql.ts` has id `staging/stg_users`.

```
models/
├── stg_users.sql.ts        # id: stg_users
├── dim_users.sql.ts        # id: dim_users
└── fct/
    └── fct_events.sql.ts   # id: fct/fct_events
```

## Model API

A model file imports helpers from `@otter/core` and default-exports a `sql` fragment.

### `sql`

```typescript
import { sql } from "@otter/core";

export default sql`select 1 as n`;
```

`sql` is a tagged template that interpolates values verbatim into the resulting SQL string. Use it
for every model body.

### `ref`

```typescript
import { ref, sql } from "@otter/core";

export default sql`select * from ${ref("stg_users")}`;
```

`ref("stg_users")` records a DAG edge `stg_users → <current model>` and expands to a
double-quoted identifier (`"stg_users"`). The compiler rewrites the quoted identifier with the
target schema before execution.

### `source`

```typescript
import { source, sql } from "@otter/core";

export default sql`select * from ${source("stripe_pg", "charges")}`;
```

`source("stripe_pg", "charges")` records the pair as a raw-table dependency and expands to
`"raw_stripe_pg_charges"`. The actual raw table is produced by `otter load stripe_pg.charges`; see
[cli.md](cli.md#load).

### `config`

```typescript
export const config = {
  materialized: "incremental",
  unique_key: "id",
  tags: ["nightly"],
} as const;
```

| Field          | Type                                 | Default | Description                                 |
| -------------- | ------------------------------------ | ------- | ------------------------------------------- |
| `materialized` | `"view" \| "table" \| "incremental"` | `view`  | Build strategy for the model                |
| `unique_key`   | `string`                             | —       | Required when `materialized: "incremental"` |
| `tags`         | `string[]`                           | —       | Labels used by selectors (`tag:<name>`)     |

## Materializations

Otter supports three materializations: `view`, `table`, and `incremental`. See
[materializations.md](materializations.md) for semantics, swap behavior, and the incremental
predicate helper.

## Dependencies and DAG

Every call to `ref` or `source` inside a model is recorded during `otter compile`. The compiler
assembles a DAG, topologically sorts it, and writes `.otter/target/manifest.json`.

- Cycles cause `otter compile` to fail.
- A `ref` to a non-existent model id is reported at compile time.
- A `source` pair that does not match a `config.sources` entry is reported at compile time.

See [cli.md](cli.md#compile) and [state.md](state.md#manifest) for the manifest format.

## Example

A three-model project showing the most common patterns.

```typescript
// models/stg_users.sql.ts
import { source, sql } from "@otter/core";

export const config = { materialized: "table" } as const;
export default sql`
  select id, email, created_at
  from ${source("stripe_pg", "users")}
`;
```

```typescript
// models/dim_users.sql.ts
import { ref, sql } from "@otter/core";

export const config = { materialized: "view", tags: ["public"] } as const;
export default sql`
  select id, lower(email) as email, created_at
  from ${ref("stg_users")}
`;
```

```typescript
// models/fct_events.sql.ts
import { ref, sql } from "@otter/core";

export const config = {
  materialized: "incremental",
  unique_key: "event_id",
  tags: ["nightly"],
} as const;
export default sql`
  select event_id, user_id, occurred_at, payload
  from ${ref("stg_events")}
`;
```

Build the whole project with `otter compile && otter build`, or select `dim_users` and its
ancestors with `otter build -s +dim_users`. See [selectors.md](selectors.md).
