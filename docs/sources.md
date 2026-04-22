# Sources

A source is an instance of a driver that knows how to stream rows from an upstream system.
`otter load <source>.<stream>` asks the source to stream rows and hands each batch to the
target adapter.

## Table of Contents

- [Source Interface](#source-interface)
- [Source Factories](#source-factories)
- [Streams and Cursors](#streams-and-cursors)
- [Adding a Source Driver](#adding-a-source-driver)

## Source Interface

Every source driver exports a factory function (e.g. `postgresSource`, `stripeSource`) that
returns a `Source`:

```typescript
export type Row = Record<string, unknown>;

export interface CursorState {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export interface ExtractOpts {
  /** Column to filter on / track the high-water mark for incremental loads. */
  cursorField?: string;
  /** Lower bound for the cursor when state has no prior value. */
  initialValue?: string;
  /** Optional upstream schema (e.g. postgres namespace). */
  schema?: string;
  /** Optional upstream identifier when it differs from `stream`. */
  identifier?: string;
}

export interface ExtractStream {
  /** Target (Postgres) column types, keyed by column name. */
  columnTypes: Record<string, string>;
  rows: AsyncIterable<Row[]>;
}

export interface Source {
  kind: string;
  extract(stream: string, state: CursorState, opts?: ExtractOpts): Promise<ExtractStream>;
  close(): Promise<void>;
}
```

- `kind` identifies the driver (e.g. `"postgres"`, `"clickhouse"`, `"stripe"`).
- `extract` returns `columnTypes` (used by the adapter to `CREATE TABLE` with real types instead
  of `text`) and a `rows` async iterable that yields batches (typically 5 000 per batch).
- `close` releases any sockets or handles the driver owns.

`ExtractOpts` is derived from the per-stream config in `sourcesDir/<name>.ts`
([`defineSource`](sources.md)) and from the CLI flags passed to `otter load`.

## Source Factories

Sources are imported and instantiated explicitly in `otter.config.ts`:

```typescript
import { postgresSource } from "@otter/source-postgres";
import { stripeSource } from "@otter/source-stripe";

export default defineConfig({
  sources: {
    app_db: postgresSource({ url: process.env.SOURCE_PG_URL ?? "" }),
    billing: stripeSource({ apiKey: process.env.STRIPE_API_KEY }),
  },
  // ...
});
```

Each factory takes a typed options object specific to that driver; missing or malformed options
surface as TypeScript errors at build time rather than runtime. Today otter ships three driver
packages:

- [source-postgres.md](source-postgres.md) — `@otter/source-postgres` exports `postgresSource`
- [source-clickhouse.md](source-clickhouse.md) — `@otter/source-clickhouse` exports `clickhouseSource`
- [source-stripe.md](source-stripe.md) — `@otter/source-stripe` exports `stripeSource`

## Streams and Cursors

- `stream` is a free-form string that the driver interprets. Postgres accepts
  `"schema.table"` or bare `"table"`. ClickHouse accepts the raw table name. Stripe treats it as
  a `/v1/<stream>` list resource.
- `CursorState` is backed by `.otter/state.db`. It is keyed by `(source_name, stream)`. Drivers
  write a high-water mark under the key `"<stream>:<cursor_field>"` when `cursor_field` is set
  in `sourcesDir/<name>.ts`. `--full-refresh` on `otter load` clears the key before extract.

See [state.md](state.md#cursors) for the on-disk schema.

## Adding a Source Driver

1. Create a new workspace package (name it whatever you like — the CLI uses the imported factory,
   not the package name).
2. Export a typed factory function that takes its own options interface and returns a `Source`.
   By convention, name it `<kind>Source` (e.g. `bigquerySource`).
3. Publish the package. Users install it alongside `@otter/cli` and import the factory in their
   `otter.config.ts`:

```typescript
import { mythingSource } from "@acme/source-mything";

sources: {
  my_thing: mythingSource({ url: process.env.MY_THING_URL ?? "" }),
}
```

and run `otter load my_thing.<stream>`.

Related: [source-postgres.md](source-postgres.md), [source-clickhouse.md](source-clickhouse.md),
[source-stripe.md](source-stripe.md), [cli.md](cli.md#load),
[packages.md](packages.md#package-map).
