# @otter/adapter-postgres

Postgres target adapter for [Otter](https://github.com/tomnagengast/otter). Implements the
`Adapter` interface from [`@otter/core`](https://jsr.io/@otter/core) using `Bun.sql` —
**no `pg` or `postgres.js` dependency**.

Responsible for: schema creation, bulk loads from `otter load`, `view` / `table` /
`incremental` materializations for `otter build`, and the atomic staging-table swap used by
`table` and `incremental` models.

## Install

```bash
# Bun
bunx jsr add @otter/adapter-postgres

# Deno
deno add jsr:@otter/adapter-postgres
```

You rarely import this package directly — the CLI resolves it via
`await import("@otter/adapter-postgres")` when you set `target.kind = "postgres"`.

## Configuration

Select the Postgres adapter in `otter.config.ts`:

```typescript
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

| Field    | Type         | Default                            | Description                                               |
| -------- | ------------ | ---------------------------------- | --------------------------------------------------------- |
| `kind`   | `"postgres"` | —                                  | Driver discriminant                                       |
| `url`    | `string`     | —                                  | `postgres://user:pass@host:port/db`                       |
| `schema` | `string`     | `analytics` (build) / `raw` (load) | Default target schema; appended to `url` as `search_path` |

The adapter appends `options=-c search_path=<schema>` to the URL so bare identifiers from
`ref()`, `source()`, and `seed()` resolve against the configured schema automatically.

## Load strategies

| Strategy  | Supported | Notes                                                                    |
| --------- | :-------: | ------------------------------------------------------------------------ |
| `append`  |     ✔     | Multi-row `INSERT` per batch                                             |
| `replace` |     ✔     | `DROP TABLE IF EXISTS`, then multi-row `INSERT` per batch                |
| `merge`   |     ✔     | `INSERT ... ON CONFLICT (unique_key) DO UPDATE`; requires `--unique-key` |

## Materialization semantics

| Materialization | Execution                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------ |
| `view`          | `CREATE OR REPLACE VIEW <schema>.<model>`                                                                    |
| `table`         | `CREATE TABLE <schema>.<model>__stg`, then atomic swap into `<schema>.<model>` inside a single transaction   |
| `incremental`   | Build staging table from compiled SQL; `INSERT ... ON CONFLICT DO UPDATE` into the final table; drop staging |

The swap uses `DROP TABLE IF EXISTS` + `ALTER TABLE ... RENAME TO` inside one transaction, so
readers never observe a missing table.

## Identifier resolution

- `ref("model_id")` → `"model_id"` (double-quoted).
- `source("pg", "charges")` → `"raw_pg_charges"` (double-quoted).
- `seed("countries")` → `"seed_countries"` (double-quoted).

Schema-qualified names are produced at execution time using the configured schema.

## Programmatic use

For tests or custom runners:

```typescript
import { createAdapter } from "@otter/adapter-postgres";

const adapter = createAdapter({
  url: process.env.PG_URL!,
  schema: "analytics",
});

const { tables } = await adapter.introspect();
await adapter.execute("create schema if not exists analytics");
await adapter.close();
```

## Full documentation

- Adapter reference —
  [adapter-postgres](https://github.com/tomnagengast/otter/blob/main/docs/adapter-postgres.md)
- Interface —
  [adapters](https://github.com/tomnagengast/otter/blob/main/docs/adapters.md)
- Load strategies —
  [load-strategies](https://github.com/tomnagengast/otter/blob/main/docs/load-strategies.md)
- Materializations —
  [materializations](https://github.com/tomnagengast/otter/blob/main/docs/materializations.md)
- Config —
  [configuration](https://github.com/tomnagengast/otter/blob/main/docs/configuration.md#targetconfig)

## License

MIT
