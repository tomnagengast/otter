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

export interface Source {
  kind: string;
  extract(stream: string, state: CursorState): AsyncIterable<Row[]>;
  close(): Promise<void>;
}
```

- `kind` mirrors the string used in `config.sources.<name>.kind`.
- `extract` yields rows in batches (typically 5 000 per batch).
- `close` releases any sockets or handles the driver owns.

## Driver Resolution

Sources are resolved by dynamic import:

```typescript
const mod = await import(`@otter/source-${kind}`);
const source = mod.createSource(config.sources[name]);
```

Today otter ships two driver packages:

- [source-postgres.md](source-postgres.md) — `@otter/source-postgres`
- [source-clickhouse.md](source-clickhouse.md) — `@otter/source-clickhouse`

Any package that matches the `@otter/source-<kind>` naming convention and exports
`createSource` will resolve at runtime.

## Streams and Cursors

- `stream` is a free-form string that the driver interprets. Postgres accepts
  `"schema.table"` or bare `"table"`. ClickHouse accepts the raw table name.
- `CursorState` is backed by `.otter/state.db`. It is keyed by `(source_name, stream)` and is
  intended for resumable / incremental extraction. Today's drivers treat it as opaque; future
  drivers (API sources especially) will persist page tokens there.

See [state.md](state.md#cursors) for the on-disk schema.

## Adding a Source Driver

1. Create a new workspace package named `@otter/source-<kind>`.
2. Export a `createSource(config: { url: string })` function returning a `Source`.
3. Add the package to the workspace `packages/` directory; `bun install` will link it.

Users can then declare:

```typescript
sources: {
  my_thing: { kind: "<kind>", url: process.env.MY_THING_URL ?? "" },
}
```

and run `otter load my_thing.<stream>`.

Related: [source-postgres.md](source-postgres.md), [source-clickhouse.md](source-clickhouse.md),
[cli.md](cli.md#load), [packages.md](packages.md#package-map).
