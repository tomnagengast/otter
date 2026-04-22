# Sources

A source is a declarative pointer at an upstream system. `otter load <source>.<stream>` asks the
source driver to stream rows from that stream and hands each batch to the target adapter.

## Table of Contents

- [Source Interface](#source-interface)
- [Driver Resolution](#driver-resolution)
- [Streams and Cursors](#streams-and-cursors)
- [Adding a Source Driver](#adding-a-source-driver)

## Source Interface

Every source driver exports a `createSource(config)` factory that returns a `Source`:

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

- `kind` mirrors the string used in `config.sources.<name>.kind`.
- `extract` returns `columnTypes` (used by the adapter to `CREATE TABLE` with real types instead
  of `text`) and a `rows` async iterable that yields batches (typically 5 000 per batch).
- `close` releases any sockets or handles the driver owns.

`ExtractOpts` is derived from the per-stream config in `sourcesDir/<name>.ts`
([`defineSource`](configuration.md#sourceconfig)) and from the CLI flags passed to
`otter load`.

## Driver Resolution

Sources are resolved by dynamic import:

```typescript
const mod = await import(`@otter/source-${kind}`);
const source = mod.createSource(config.sources[name]);
```

Today otter ships three driver packages:

- [source-postgres.md](source-postgres.md) — `@otter/source-postgres`
- [source-clickhouse.md](source-clickhouse.md) — `@otter/source-clickhouse`
- [source-stripe.md](source-stripe.md) — `@otter/source-stripe`

Any package that matches the `@otter/source-<kind>` naming convention and exports
`createSource` will resolve at runtime.

## Streams and Cursors

- `stream` is a free-form string that the driver interprets. Postgres accepts
  `"schema.table"` or bare `"table"`. ClickHouse accepts the raw table name. Stripe treats it as
  a `/v1/<stream>` list resource.
- `CursorState` is backed by `.otter/state.db`. It is keyed by `(source_name, stream)`. Drivers
  write a high-water mark under the key `"<stream>:<cursor_field>"` when `cursor_field` is set
  in `sourcesDir/<name>.ts`. `--full-refresh` on `otter load` clears the key before extract.

See [state.md](state.md#cursors) for the on-disk schema.

## Adding a Source Driver

1. Create a new workspace package named `@otter/source-<kind>`.
2. Export a `createSource(config: SourceConfig)` function returning a `Source`. Read
   `config.url` for connection-string sources or `config.options` for API-style sources.
3. Add the package to the workspace `packages/` directory; `bun install` will link it.

Users can then declare:

```typescript
sources: {
  my_thing: { kind: "<kind>", url: process.env.MY_THING_URL ?? "" },
  my_api:   { kind: "<kind>", options: { apiKey: process.env.MY_API_KEY } },
}
```

and run `otter load my_thing.<stream>`.

Related: [source-postgres.md](source-postgres.md), [source-clickhouse.md](source-clickhouse.md),
[source-stripe.md](source-stripe.md), [cli.md](cli.md#load),
[packages.md](packages.md#package-map).
