# Postgres Source

`@otter/source-postgres` extracts rows from a Postgres database and feeds them to `otter load`. It
uses `Bun.sql` — no `pg` or `postgres.js` dependency.

## Configuration

Import `postgresSource` and declare the source under `sources` in `otter.config.ts`:

| Option | Type     | Default | Description                       |
| ------ | -------- | ------- | --------------------------------- |
| `url`  | `string` | —       | Source Postgres connection string |

```typescript
// otter.config.ts (excerpt)
import { postgresSource } from "@otter/source-postgres";

sources: {
  stripe_pg: postgresSource({ url: process.env.STRIPE_PG_URL ?? "" }),
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

- Column types are pulled from `information_schema.columns` up front so the target `CREATE TABLE`
  uses real Postgres types instead of `text`.
- Batched extraction via `Bun.sql` in pages of 5 000 rows.
- Without a cursor: `select * from <schema>.<table> order by 1 limit 5000 offset <n>`.
- With a cursor: `select * from <schema>.<table> where <cursor_field> > <cursor> order by <cursor_field> asc limit 5000`.

## Incremental

Declare an incremental cursor per stream in `sources/<name>.ts`:

```typescript
// sources/stripe_pg.ts
import { defineSource } from "@otter/core";

export default defineSource({
  streams: {
    users: {
      write_disposition: "merge",
      primary_key: "id",
      incremental: { cursor_field: "updated_at" },
    },
  },
});
```

The driver reads the high-water mark from `.otter/state.db` (key `<stream>:<cursor_field>`),
filters with `where <cursor_field> > <cursor>`, and writes the last value back after each batch.
Pass `--full-refresh` to `otter load` to clear the cursor before extract. See
[state.md](state.md#cursors).

## Example

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter/adapter-postgres";
import { defineConfig } from "@otter/core";
import { postgresSource } from "@otter/source-postgres";

export default defineConfig({
  profiles: { dev: { target: postgresAdapter({ url: process.env.PG_URL ?? "" }) } },
  sources: {
    stripe_pg: postgresSource({ url: process.env.STRIPE_PG_URL ?? "" }),
  },
  modelsDir: "models",
});
```

```bash
otter load stripe_pg.charges --strategy merge --unique-key id
```

Related: [sources.md](sources.md#source-interface), [configuration.md](configuration.md#sources),
[cli.md](cli.md#load), [materializations.md](materializations.md#incremental).
