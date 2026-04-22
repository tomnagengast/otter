# ClickHouse Source

`@otter-sh/source-clickhouse` extracts rows from a ClickHouse database via the HTTP interface using
`FORMAT JSONEachRow`. No native ClickHouse client dependency — the driver streams over `fetch`.

## Configuration

Import `clickhouseSource` and declare the source under `sources` in `otter.config.ts`:

| Option | Type     | Default | Description                          |
| ------ | -------- | ------- | ------------------------------------ |
| `url`  | `string` | —       | HTTP(S) URL of the ClickHouse server |

```typescript
// otter.config.ts (excerpt)
import { clickhouseSource } from "@otter-sh/source-clickhouse";

sources: {
  events_ch: clickhouseSource({
    url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
  }),
},
```

## Streams

A stream name passed to `otter load <source>.<stream>` maps directly to a ClickHouse table. It is
backtick-quoted automatically, so dotted names like `default.events` are split and each segment
is quoted independently.

```bash
otter load events_ch.events
otter load events_ch.logs.app_errors   # quoted as `logs`.`app_errors`
```

## Extract Behavior

- `DESCRIBE TABLE` is run first so the target `CREATE TABLE` uses real Postgres types instead of
  `text` (ClickHouse types are mapped: `Int64`/`UInt64` → `bigint`, `Float64` → `double precision`,
  `DateTime*` → `timestamptz`, etc.).
- HTTP `POST` to the ClickHouse endpoint with `default_format=JSONEachRow` appended to the query
  string.
- Body: `SELECT * FROM <quoted-stream>[ WHERE <cursor_field> > <cursor>][ ORDER BY <cursor_field> ASC] FORMAT JSONEachRow`.
- Response body is read as a stream; each newline-delimited JSON line is parsed into a `Row` and
  buffered into 5 000-row batches.
- `AsyncIterable<Row[]>` is yielded to `otter load` batch by batch.

## Auth

If the configured `url` contains a username and password (e.g.
`http://user:pass@clickhouse.example:8123`), the driver strips them from the URL and attaches an
`Authorization: Basic …` header instead. URL-encoded characters in the user/password are decoded
before base64 encoding.

## Pagination and Cursors

The driver streams the full result set in one HTTP request rather than paginating. When a stream
declares `incremental.cursor_field` in `sources/<name>.ts`, the SQL is rewritten with
`WHERE <cursor_field> > <cursor> ORDER BY <cursor_field> ASC`, and the max value seen in the
response is written back to `.otter/state.db` after the stream drains. Pass `--full-refresh` to
`otter load` to clear the cursor.

```typescript
// sources/events_ch.ts
import { defineSource } from "@otter-sh/core";

export default defineSource({
  streams: {
    events: {
      write_disposition: "append",
      incremental: { cursor_field: "event_time" },
    },
  },
});
```

See [models.md](models.md#model-api) for incremental model config and
[materializations.md](materializations.md#incremental) for the adapter-side merge flow.

## Example

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter-sh/adapter-postgres";
import { defineConfig } from "@otter-sh/core";
import { clickhouseSource } from "@otter-sh/source-clickhouse";

export default defineConfig({
  profiles: { dev: { target: postgresAdapter({ url: process.env.PG_URL ?? "" }) } },
  sources: {
    events_ch: clickhouseSource({
      url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
    }),
  },
  modelsDir: "models",
});
```

```bash
otter load events_ch.events --strategy append
```

Related: [sources.md](sources.md#source-interface), [configuration.md](configuration.md#sources),
[cli.md](cli.md#load), [materializations.md](materializations.md#incremental).
