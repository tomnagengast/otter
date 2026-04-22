# @otter/source-clickhouse

ClickHouse source for `otter`. Implements the `Source` interface from `@otter/core` using the
ClickHouse HTTP interface with `FORMAT JSONEachRow`. Streams rows via the `fetch` API in batches of
5 000 — no native ClickHouse client dependency.

## Interface

```ts
import { createSource } from "@otter/source-clickhouse";

const source = createSource({ url: "http://localhost:8123" });

for await (const batch of source.extract("events", state)) {
  console.log(batch.length, "rows");
}

await source.close();
```

`stream` is the ClickHouse table name (backtick-quoted automatically).

## Integration tests

Set `CLICKHOUSE_TEST_URL` and run `bun test` (or `bun run test:e2e` from the repo root with Docker).
