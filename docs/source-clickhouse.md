# ClickHouse Source

`@otter/source-clickhouse` extracts rows from a ClickHouse database via the HTTP interface using
`FORMAT JSONEachRow`. No native ClickHouse client dependency — the driver streams over `fetch`.

## Configuration

Declare a ClickHouse source under `sources` in `otter.config.ts`:

| Field  | Type           | Default | Description                          |
| ------ | -------------- | ------- | ------------------------------------ |
| `kind` | `"clickhouse"` | —       | Driver discriminant                  |
| `url`  | `string`       | —       | HTTP(S) URL of the ClickHouse server |

```typescript
// otter.config.ts (excerpt)
sources: {
  events_ch: {
    kind: "clickhouse",
    url: process.env.CLICKHOUSE_URL ?? "http://localhost:8123",
  },
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

- HTTP `POST` to the ClickHouse endpoint with `default_format=JSONEachRow` appended to the query
  string.
- Body: `SELECT * FROM <quoted-stream> FORMAT JSONEachRow`.
- Response body is read as a stream; each newline-delimited JSON line is parsed into a `Row` and
  buffered into 5 000-row batches.
- `AsyncIterable<Row[]>` is yielded to `otter load` batch by batch.

## Auth

If the configured `url` contains a username and password (e.g.
`http://user:pass@clickhouse.example:8123`), the driver strips them from the URL and attaches an
`Authorization: Basic …` header instead. URL-encoded characters in the user/password are decoded
before base64 encoding.

## Pagination and Cursors

The current driver streams the full result set in one HTTP request — there is no cursor-based
pagination today. `CursorState` is passed through but unused. For large tables, combine
incremental models with a `WHERE` clause in your model SQL.

See [models.md](models.md#model-api) for incremental model config and
[materializations.md](materializations.md#incremental) for the adapter-side merge flow.

## Example

```typescript
// otter.config.ts
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

```bash
otter load events_ch.events --strategy append
```

Related: [sources.md](sources.md#source-interface), [configuration.md](configuration.md#sourceconfig),
[cli.md](cli.md#load), [materializations.md](materializations.md#incremental).
