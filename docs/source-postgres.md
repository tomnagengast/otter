# Postgres Source

`@otter/source-postgres` extracts rows from a Postgres database and feeds them to `otter load`. It
uses `Bun.sql` — no `pg` or `postgres.js` dependency.

## Configuration

Declare a Postgres source under `sources` in `otter.config.ts`:

| Field  | Type         | Default | Description                       |
| ------ | ------------ | ------- | --------------------------------- |
| `kind` | `"postgres"` | —       | Driver discriminant               |
| `url`  | `string`     | —       | Source Postgres connection string |

```typescript
// otter.config.ts (excerpt)
sources: {
  stripe_pg: {
    kind: "postgres",
    url: process.env.STRIPE_PG_URL ?? "",
  },
},
```

## Streams

A stream name passed to `otter load <source>.<stream>` is parsed as follows:

- `"schema.table"` → reads from `schema.table`.
- `"table"` (no dot) → reads from `public.table`.

```bash
otter load stripe_pg.charges           # public.charges
otter load stripe_pg.billing.invoices  # billing.invoices
```

## Extract Behavior

- Batched extraction via `Bun.sql` in pages of 5 000 rows.
- `select * from <schema>.<table> order by 1 limit 5000 offset <n>` per page.
- Streams rows as `AsyncGenerator<Row[]>`, so `otter load` processes one batch at a time.

## Incremental

For incremental models sourced from a Postgres raw table, otter reads the target's current
`max(<cursor>)` at runtime and filters the staging build to rows strictly greater. See
[materializations.md](materializations.md#incremental) for the user-facing contract.

## Example

```typescript
// otter.config.ts
import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: { dev: { target: { kind: "postgres", url: process.env.PG_URL ?? "" } } },
  sources: {
    stripe_pg: { kind: "postgres", url: process.env.STRIPE_PG_URL ?? "" },
  },
  modelsDir: "models",
});
```

```bash
otter load stripe_pg.charges --strategy merge --unique-key id
```

Related: [sources.md](sources.md#source-interface), [configuration.md](configuration.md#sourceconfig),
[cli.md](cli.md#load), [materializations.md](materializations.md#incremental).
