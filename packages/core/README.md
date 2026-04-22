# @otter/core

Shared types, config loader, compiler, DAG runner, selector engine, and state store for
[Otter](https://github.com/tomnagengast/otter) — a Bun-native ELT tool with `.sql` models and a
TypeScript config. Every other `@otter/*` package depends on this one and it has no runtime
dependencies outside Bun built-ins (`Bun.sql`, `bun:sqlite`, `Bun.file`).

Most users do not import `@otter/core` directly — they install
[`@otter/cli`](https://jsr.io/@otter/cli) and write an `otter.config.ts`. Import this package
when you are authoring a **source driver**, **target adapter**, or a programmatic runner that
drives `compile` / `build` from code.

## Install

```bash
# Bun
bunx jsr add @otter/core

# Deno
deno add jsr:@otter/core
```

## What's exported

- **Config** — `defineConfig`, `loadConfig`, `Config`, `ProfileConfig`, `SourceConfig`,
  `TargetConfig`.
- **Source authoring** — `defineSource`, `resolveSource`, `Source`, `ExtractOpts`,
  `ExtractStream`, `Row`, `CursorState`, `WriteDisposition`, `IncrementalConfig`.
- **Adapter authoring** — `resolveAdapter`, `Adapter`, `LoadStrategy`, `TableRef`,
  `MergeIncrementalOpts`, `NotSupportedError`.
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
  sources: {
    stripe_pg: { kind: "postgres", url: process.env.STRIPE_PG_URL ?? "" },
  },
  modelsDir: "models",
});
```

`defineConfig` is a type-only identity helper — it anchors inference on the `Config` type.

## Writing a source driver

A source driver is any package that exports `createSource(config)` returning a `Source`. The
CLI resolves it at runtime as `@otter/source-<kind>`:

```typescript
import type { Source, ExtractStream, CursorState, ExtractOpts } from "@otter/core";

export function createSource(config: { url: string }): Source {
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

A target adapter is any package that exports `createAdapter(config)` returning an `Adapter`.
The CLI resolves it at runtime as `@otter/adapter-<kind>`:

```typescript
import type { Adapter, TableRef, LoadStrategy, Row } from "@otter/core";

export function createAdapter(config: { url: string; schema?: string }): Adapter {
  return {
    kind: "my-db",
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
