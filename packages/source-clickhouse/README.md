# @otter/source-clickhouse

ClickHouse source for [Otter](https://github.com/tomnagengast/otter). Implements the `Source`
interface from [`@otter/core`](https://jsr.io/@otter/core) over the ClickHouse HTTP interface
using `FORMAT JSONEachRow` — **no native ClickHouse client dependency**. Streams rows via
`fetch` in batches of 5 000.

## Install

```bash
# Bun
bunx jsr add @otter/source-clickhouse

# Deno
deno add jsr:@otter/source-clickhouse
```

You rarely import this package directly — the CLI resolves it via
`await import("@otter/source-clickhouse")` when you declare a source with `kind: "clickhouse"`.

## Configuration

Declare a ClickHouse source under `sources` in `otter.config.ts`:

```typescript
import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: { dev: { target: { kind: "postgres", url: process.env.PG_URL ?? "" } } },
  sources: {
    events_ch: {
      kind: "clickhouse",
      url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
    },
  },
  modelsDir: "models",
});
```

| Field  | Type           | Default | Description                          |
| ------ | -------------- | ------- | ------------------------------------ |
| `kind` | `"clickhouse"` | —       | Driver discriminant                  |
| `url`  | `string`       | —       | HTTP(S) URL of the ClickHouse server |

### Auth

Embed credentials in the URL (`http://user:pass@clickhouse.example:8123`). The driver strips
them from the URL and attaches an `Authorization: Basic …` header. URL-encoded characters in
the user/password are decoded before base64 encoding.

## Streams

A stream name passed to `otter load <source>.<stream>` maps directly to a ClickHouse table.
Dotted names like `default.events` are split and each segment is backtick-quoted independently
(`` `default`.`events` ``).

```bash
otter load events_ch.events
otter load events_ch.logs.app_errors   # quoted as `logs`.`app_errors`
```

## Extract behavior

- `DESCRIBE TABLE` runs first so the target `CREATE TABLE` uses real Postgres types. ClickHouse
  types are mapped: `Int64`/`UInt64` → `bigint`, `Float64` → `double precision`, `DateTime*` →
  `timestamptz`, etc.
- HTTP `POST` to the ClickHouse endpoint with `default_format=JSONEachRow` on the query string.
- Body:
  `SELECT * FROM <quoted-stream>[ WHERE <cursor_field> > <cursor>][ ORDER BY <cursor_field> ASC] FORMAT JSONEachRow`.
- The response body is read as a stream; each newline-delimited JSON line is parsed into a
  `Row` and buffered into 5 000-row batches yielded as `AsyncIterable<Row[]>`.

## Incremental loads

Declare a cursor per stream in `sources/<name>.ts`:

```typescript
// sources/events_ch.ts
import { defineSource } from "@otter/core";

export default defineSource({
  streams: {
    events: {
      write_disposition: "append",
      incremental: { cursor_field: "event_time" },
    },
  },
});
```

The driver rewrites the SQL to
`WHERE <cursor_field> > <cursor> ORDER BY <cursor_field> ASC` and writes the max value seen in
the response back to `.otter/state.db` after the stream drains. Pass `--full-refresh` to
`otter load` to clear the cursor.

The full result set streams in a single HTTP request — no client-side pagination.

## Example

```bash
otter load events_ch.events --strategy append
```

## Full documentation

- Driver reference —
  [source-clickhouse](https://github.com/tomnagengast/otter/blob/main/docs/source-clickhouse.md)
- Interface — [sources](https://github.com/tomnagengast/otter/blob/main/docs/sources.md)
- Incremental models —
  [models#model-api](https://github.com/tomnagengast/otter/blob/main/docs/models.md#model-api),
  [materializations#incremental](https://github.com/tomnagengast/otter/blob/main/docs/materializations.md#incremental)
- `otter load` CLI — [cli#load](https://github.com/tomnagengast/otter/blob/main/docs/cli.md#load)

## License

MIT
