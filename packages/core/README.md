# @otter-sh/core

Shared types, config loader, compiler, DAG runner, selector engine, and state store for
[Otter](https://github.com/tomnagengast/otter) — a Bun-native ELT tool with `.sql` models and a
TypeScript config. Every other `@otter-sh/*` package depends on this one and it has no runtime
dependencies outside Bun built-ins (`Bun.sql`, `bun:sqlite`, `Bun.file`).

Most users do not import `@otter-sh/core` directly — they install
[`@otter-sh/cli`](https://www.npmjs.com/package/@otter-sh/cli) and write an `otter.config.ts`.
Import this package when you are authoring a **source driver**, **target adapter**, or a
programmatic runner that drives `compile` / `build` from code.

## Install

```bash
bun add @otter-sh/core
```

Requires Bun — this package imports `"bun"` and `"bun:sqlite"` at runtime.

## What's exported

- **Config** — `defineConfig`, `loadConfig`, `Config`, `ProfileConfig`.
- **Source authoring** — `defineSource`, `Source`, `ExtractOpts`, `ExtractStream`, `Row`,
  `CursorState`, `WriteDisposition`, `IncrementalConfig`.
- **Adapter authoring** — `Adapter`, `LoadStrategy`, `TableRef`, `MergeIncrementalOpts`,
  `NotSupportedError`.
- **Compile / run** — `compileProject`, `buildDag`, `toposort`, `runBuild`, `runModelTests`,
  `readManifest`, `writeManifest`, `writeCompiledSql`, `Manifest`, `Dag`, `DagNode`,
  `ColumnConfig`, `ColumnTest`.
- **Selectors** — `parseSelector`, `evaluateSelector`.
- **State** — `openState`, `StateStore`, `incrementalPredicate`, `nextCursor`.
- **Events** — `OtterEmitter`, `jsonlAppender`, `NodeEvent`.
- **Seeds** — `discoverSeeds`, `loadSeeds`, `parseCsv`.

## Using `defineConfig`

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter-sh/adapter-postgres";
import { defineConfig } from "@otter-sh/core";
import { postgresSource } from "@otter-sh/source-postgres";

export default defineConfig({
  profiles: {
    dev: {
      target: postgresAdapter({
        url: process.env.PG_URL ?? "postgres://localhost:5432/dev",
        schema: "analytics",
      }),
    },
  },
  sources: {
    stripe_pg: postgresSource({ url: process.env.STRIPE_PG_URL ?? "" }),
  },
  modelsDir: "models",
});
```

`defineConfig` is a type-only identity helper — it anchors inference on the `Config` type.

## Writing a source driver

A source driver is any package that exports a typed factory returning a `Source`. The factory is
imported explicitly from `otter.config.ts`:

```typescript
import type { Source, ExtractStream, CursorState, ExtractOpts } from "@otter-sh/core";

export interface MySourceOptions {
  url: string;
}

export function mySource(options: MySourceOptions): Source {
  return {
    kind: "my-thing",
    async extract(stream, state, opts): Promise<ExtractStream> {
      // Return { columnTypes, rows: AsyncIterable<Row[]> }.
    },
    async close() {},
  };
}
```

## Writing a target adapter

A target adapter is any package that exports a typed factory returning an `Adapter`:

```typescript
import type { Adapter, TableRef, LoadStrategy, Row } from "@otter-sh/core";

export interface MyAdapterOptions {
  url: string;
  schema?: string;
}

export function myAdapter(options: MyAdapterOptions): Adapter {
  const schema = options.schema ?? "public";
  return {
    kind: "my-db",
    schema,
    async introspect() {
      /* ... */
    },
    async bulkLoad(target, rows, strategy, opts) {
      /* ... */
    },
    async execute(sql) {
      /* ... */
    },
    async swap(staging, final) {
      /* ... */
    },
    async close() {},
  };
}
```

Implement `mergeIncremental` to support `materialized: "incremental"` models; leave it undefined
to raise `NotSupportedError` instead.

## Declaring source streams

`defineSource` describes per-stream write dispositions and incremental cursors. The CLI reads
these from `sourcesDir/<name>.ts`:

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

## Full documentation

- Interfaces — [sources](https://github.com/tomnagengast/otter/blob/main/docs/sources.md),
  [adapters](https://github.com/tomnagengast/otter/blob/main/docs/adapters.md)
- Config —
  [configuration](https://github.com/tomnagengast/otter/blob/main/docs/configuration.md),
  [profiles](https://github.com/tomnagengast/otter/blob/main/docs/profiles.md)
- Models —
  [models](https://github.com/tomnagengast/otter/blob/main/docs/models.md),
  [materializations](https://github.com/tomnagengast/otter/blob/main/docs/materializations.md),
  [load-strategies](https://github.com/tomnagengast/otter/blob/main/docs/load-strategies.md),
  [selectors](https://github.com/tomnagengast/otter/blob/main/docs/selectors.md)
- Runtime —
  [state](https://github.com/tomnagengast/otter/blob/main/docs/state.md),
  [observability](https://github.com/tomnagengast/otter/blob/main/docs/observability.md)

## License

MIT
