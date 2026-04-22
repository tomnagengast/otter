# @otter/adapter-postgres

Postgres target adapter for `otter`. Implements the `Adapter` interface from `@otter/core` using
`Bun.sql` (no `pg` or `postgres.js`).

## Capabilities

- `bulkLoad` — multi-row `INSERT` with `append`, `replace`, or `merge` strategies
- `execute` — run arbitrary SQL (used by the DAG runner for `CREATE TABLE/VIEW`)
- `swap` — atomic staging-table rename inside a transaction
- `introspect` — lists all base tables from `information_schema`

## Interface

```ts
import { createAdapter } from "@otter/adapter-postgres";

const adapter = createAdapter({
  url: "postgres://user:pass@host:5432/db",
  schema: "analytics", // default schema for model materialization
});

await adapter.bulkLoad({ schema: "raw", name: "charges" }, rowsAsyncIterable, "merge", {
  uniqueKey: "id",
});

await adapter.close();
```

## Integration tests

Set `PG_TEST_URL` and run `bun test` (or `bun run test:e2e` from the repo root with Docker).
