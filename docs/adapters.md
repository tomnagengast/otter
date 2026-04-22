# Adapters

An adapter is the driver that writes into a target. It owns schema creation, bulk loads,
materialization execution, and the staging-table swap used by `table` and `incremental` models.

## Table of Contents

- [Adapter Interface](#adapter-interface)
- [Adapter Factories](#adapter-factories)
- [Capability Matrix](#capability-matrix)
- [Adding an Adapter](#adding-an-adapter)

## Adapter Interface

Every adapter exports a factory function (e.g. `postgresAdapter`) that returns an `Adapter`:

```typescript
export interface TableRef {
  schema: string;
  name: string;
}

export type LoadStrategy = "append" | "merge" | "replace";

export interface MergeIncrementalOpts {
  staging: TableRef;
  final: TableRef;
  compiledSql: string;
  uniqueKey: string;
}

export interface Adapter {
  kind: string;
  /** Default schema used for materialization and bare-identifier resolution. */
  schema: string;
  introspect(): Promise<{ tables: TableRef[] }>;
  bulkLoad(
    target: TableRef,
    rows: AsyncIterable<Row[]>,
    strategy: LoadStrategy,
    opts?: { uniqueKey?: string },
  ): Promise<{ rows: number; duration_ms: number }>;
  execute(sql: string): Promise<{ rows_affected?: number; rows?: Row[]; duration_ms: number }>;
  swap(staging: TableRef, final: TableRef): Promise<void>;
  mergeIncremental?(opts: MergeIncrementalOpts): Promise<void>;
  close(): Promise<void>;
}
```

- `kind` identifies the adapter (e.g. `"postgres"`).
- `schema` is the default schema the adapter writes into; the CLI reads this when constructing
  `TableRef`s and setting `search_path`.
- `introspect` returns the list of base tables visible to the adapter.
- `bulkLoad` consumes the source `AsyncIterable<Row[]>` and lands rows using the requested
  strategy. It also creates the schema and table on first batch.
- `execute` runs arbitrary SQL — used by the DAG runner for `CREATE VIEW`, `CREATE TABLE AS`,
  and `SELECT` previews.
- `swap` renames `staging` → `final` inside a single transaction. It is the critical step for
  `table` materialization to be atomic.
- `mergeIncremental` is optional. Adapters that do not implement it raise `NotSupportedError`
  when a model with `materialized: "incremental"` runs.
- `close` releases the connection pool.

## Adapter Factories

Adapters are imported and instantiated explicitly in `otter.config.ts`:

```typescript
import { postgresAdapter } from "@otter-sh/adapter-postgres";

export default defineConfig({
  profiles: {
    dev: {
      target: postgresAdapter({
        url: process.env.PG_URL ?? "",
        schema: "analytics",
      }),
    },
  },
  // ...
});
```

Today otter ships a single adapter: [adapter-postgres.md](adapter-postgres.md).

## Capability Matrix

| Adapter                                 | `append` | `merge` | `replace` | `view` | `table` | `incremental` |
| --------------------------------------- | :------: | :-----: | :-------: | :----: | :-----: | :-----------: |
| [adapter-postgres](adapter-postgres.md) |    ✔     |    ✔    |     ✔     |   ✔    |    ✔    |       ✔       |

See [load-strategies.md](load-strategies.md) for strategy semantics and
[materializations.md](materializations.md) for materialization semantics.

## Adding an Adapter

1. Create a new package (name it whatever you like — the CLI uses the imported factory, not the
   package name).
2. Export a typed factory function that takes its own options interface and returns an `Adapter`.
   By convention, name it `<kind>Adapter` (e.g. `bigqueryAdapter`). Remember to populate `schema`
   on the returned object.
3. Implement `bulkLoad`, `execute`, `swap`, and `close`. Implement `mergeIncremental` if the
   database supports an upsert primitive (otherwise leave it unset).
4. Publish the package. Users install it and import the factory in their `otter.config.ts`:

```typescript
import { myAdapter } from "@acme/adapter-mything";

profiles: {
  dev: { target: myAdapter({ url: process.env.MY_URL ?? "" }) },
}
```

Related: [adapter-postgres.md](adapter-postgres.md), [load-strategies.md](load-strategies.md),
[materializations.md](materializations.md), [packages.md](packages.md#package-map).
