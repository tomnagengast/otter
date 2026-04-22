# Postgres Adapter

`@otter/adapter-postgres` is the target adapter otter uses to materialize models and land raw
tables from `otter load`. It uses `Bun.sql` under the hood — no `pg` or `postgres.js` dependency.

## Configuration

Select the Postgres adapter by setting `profiles.<name>.target.kind = "postgres"` in
`otter.config.ts` (see [configuration.md](configuration.md#targetconfig)).

| Field    | Type         | Default  | Description                                                      |
| -------- | ------------ | -------- | ---------------------------------------------------------------- |
| `kind`   | `"postgres"` | —        | Driver discriminant                                              |
| `url`    | `string`     | —        | Postgres connection string (`postgres://user:pass@host:port/db`) |
| `schema` | `string`     | `public` | Default schema for materialized models and raw tables            |

The adapter appends `options=-c search_path=<schema>` to the URL so bare identifiers from `ref`,
`source`, and `seed` resolve against the configured schema automatically.

## Load Strategies

| Strategy  | Supported | Notes                                                                    |
| --------- | --------- | ------------------------------------------------------------------------ |
| `append`  | ✔         | Multi-row `INSERT` per batch                                             |
| `replace` | ✔         | `DROP TABLE IF EXISTS`, then multi-row `INSERT` per batch                |
| `merge`   | ✔         | `INSERT ... ON CONFLICT (unique_key) DO UPDATE`; requires `--unique-key` |

See [load-strategies.md](load-strategies.md) for semantics and cross-adapter compatibility.

## Materialization Semantics

| Materialization | Strategy                                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `view`          | `CREATE OR REPLACE VIEW <schema>.<model>`                                                                    |
| `table`         | `CREATE TABLE <schema>.<model>_tmp` → swap into `<schema>.<model>` in a transaction                          |
| `incremental`   | Build staging table from compiled SQL; `INSERT ... ON CONFLICT DO UPDATE` into the final table; drop staging |

Swap uses `DROP TABLE IF EXISTS` + `ALTER TABLE ... RENAME TO` inside a single transaction, so
readers never observe a missing table.

See [materializations.md](materializations.md) for the user-facing contract.

## Identifiers

- `ref("model_id")` → `"model_id"` (double-quoted).
- `source("pg", "charges")` → `"raw_pg_charges"` (double-quoted).
- `seed("countries")` → `"seed_countries"` (double-quoted).

Schema-qualified names (`"schema"."name"`) are produced by the adapter at execution time using the
configured schema.

## Example

```typescript
// otter.config.ts
import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: {
    dev: {
      target: {
        kind: "postgres",
        url: process.env.PG_URL ?? "postgres://localhost:5432/dev",
        schema: "analytics",
      },
    },
  },
  sources: {},
  modelsDir: "models",
});
```

Related: [configuration.md](configuration.md#targetconfig), [load-strategies.md](load-strategies.md),
[materializations.md](materializations.md), [adapters.md](adapters.md#adapter-interface).
