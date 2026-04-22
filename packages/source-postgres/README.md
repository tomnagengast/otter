# @otter/source-postgres

Postgres source for `otter`. Implements the `Source` interface from `@otter/core` using `Bun.sql`.
Extracts rows from a source Postgres table in paginated batches of 5 000 rows, ordered by the
first column.

## Interface

```ts
import { createSource } from "@otter/source-postgres";

const source = createSource({ url: "postgres://user:pass@host:5432/db" });

for await (const batch of source.extract("public.charges", state)) {
  console.log(batch.length, "rows");
}

await source.close();
```

`stream` accepts `schema.table` or bare `table` (defaults to `public`).

## Integration tests

Set `PG_SOURCE_TEST_URL` and run `bun test` (or `bun run test:e2e` from the repo root with Docker).
