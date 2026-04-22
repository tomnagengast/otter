# @otter-sh/source-postgres

Postgres source for [Otter](https://github.com/tomnagengast/otter). Implements the `Source`
interface from [`@otter-sh/core`](https://www.npmjs.com/package/@otter-sh/core) using `Bun.sql`
— **no `pg` or `postgres.js` dependency**. Extracts rows in paginated batches of 5 000.

Reads column types from `information_schema.columns` up front so the target `CREATE TABLE` uses
real Postgres types instead of `text`.

## Install

```bash
bun add @otter-sh/source-postgres
```

Add it to your project's `dependencies` alongside `@otter-sh/core` and `@otter-sh/cli`.
Requires Bun.

## Configuration

Import `postgresSource` and declare the source under `sources` in `otter.config.ts`:

```typescript
import { postgresAdapter } from "@otter-sh/adapter-postgres";
import { defineConfig } from "@otter-sh/core";
import { postgresSource } from "@otter-sh/source-postgres";

export default defineConfig({
  profiles: { dev: { target: postgresAdapter({ url: process.env.PG_URL ?? "" }) } },
  sources: {
    stripe_pg: postgresSource({ url: process.env.STRIPE_PG_URL ?? "" }),
  },
  modelsDir: "models",
});
```

| Option | Type     | Default | Description                       |
| ------ | -------- | ------- | --------------------------------- |
| `url`  | `string` | —       | Source Postgres connection string |

## Streams

A stream name passed to `otter load <source>.<stream>` is parsed as:

- `"schema.table"` → reads from `schema.table`.
- `"table"` (no dot) → reads from `public.table`.

```bash
otter load stripe_pg.charges           # public.charges
otter load stripe_pg.billing.invoices  # billing.invoices
```

## Extract behavior

- Column types pulled from `information_schema.columns`.
- Batched extraction via `Bun.sql` in pages of 5 000 rows.
- Without a cursor: `select * from <schema>.<table> order by 1 limit 5000 offset <n>`.
- With a cursor:
  `select * from <schema>.<table> where <cursor_field> > <cursor> order by <cursor_field> asc limit 5000`.

## Incremental loads

Declare an incremental cursor per stream in `sources/<name>.ts`:

```typescript
// sources/stripe_pg.ts
import { defineSource } from "@otter-sh/core";

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
filters with `where <cursor_field> > <cursor>`, and writes the last value back after each
batch. Pass `--full-refresh` to `otter load` to clear the cursor before extract.

## Example

```bash
otter load stripe_pg.charges --strategy merge --unique-key id
otter load stripe_pg.users   --full-refresh
```

## Full documentation

- Driver reference —
  [source-postgres](https://github.com/tomnagengast/otter/blob/main/docs/source-postgres.md)
- Interface — [sources](https://github.com/tomnagengast/otter/blob/main/docs/sources.md)
- State / cursors — [state](https://github.com/tomnagengast/otter/blob/main/docs/state.md)
- `otter load` CLI — [cli#load](https://github.com/tomnagengast/otter/blob/main/docs/cli.md#load)

## License

MIT
