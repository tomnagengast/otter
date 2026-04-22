# Stripe Source

`@otter/source-stripe` extracts data from the Stripe REST API and feeds it to `otter load`. It
uses Bun's built-in `fetch` — no `stripe` SDK dependency.

## Configuration

Declare a Stripe source under `sources` in `otter.config.ts`. Stripe authenticates with a secret
key, so the driver reads `options` instead of `url`:

| Field     | Type                | Default | Description                      |
| --------- | ------------------- | ------- | -------------------------------- |
| `kind`    | `"stripe"`          | —       | Driver discriminant              |
| `options` | `Record<string, _>` | —       | Driver options (see table below) |

| Option          | Type     | Default                  | Description                                     |
| --------------- | -------- | ------------------------ | ----------------------------------------------- |
| `apiKey`        | `string` | `STRIPE_API_KEY`         | Secret key. Required unless set in env.         |
| `apiVersion`    | `string` | `2025-04-30.basil`       | Pinned `Stripe-Version` header.                 |
| `stripeAccount` | `string` | —                        | Sets `Stripe-Account` for Connect applications. |
| `pageSize`      | `number` | `100`                    | List `limit` per request (clamped 1–100).       |
| `baseUrl`       | `string` | `https://api.stripe.com` | Override for tests or self-hosted gateways.     |

```typescript
// otter.config.ts (excerpt)
sources: {
  stripe: {
    kind: "stripe",
    options: { apiKey: process.env.STRIPE_API_KEY },
  },
},
```

## Streams

A stream name passed to `otter load <source>.<stream>` is appended to `/v1/` to form the
endpoint. Declare the resources you want under `sources/stripe.ts`:

```typescript
// sources/stripe.ts
import { defineSource } from "@otter/core";

export default defineSource({
  streams: {
    customers: {
      write_disposition: "merge",
      primary_key: "id",
      incremental: { cursor_field: "created" },
    },
    charges: {
      write_disposition: "append",
      incremental: { cursor_field: "created" },
    },
  },
});
```

Use `identifier` to override the path when the stream name should differ from the URL segment.

## Extract Behavior

- `GET https://api.stripe.com/v1/<stream>?limit=<pageSize>` with `Authorization: Bearer <key>`.
- Paginates via `starting_after=<last_id>` until `has_more` is false.
- Top-level scalars become typed columns (`text`, `bigint`, `double precision`, `boolean`).
  Nested objects and arrays land as `jsonb` (serialized as JSON strings on the wire).
- Retries `429` and `5xx` responses up to five times, honoring `Retry-After`.

## Incremental

`cursor_field` defaults to `created` when a stream declares `incremental` without one. State
stores the max unix timestamp seen; the next run sends `created[gt]=<cursor>` so you only fetch
new records. Use `initial_value` (a unix timestamp as a string) to seed the cursor the first
time a stream runs — useful to backfill from a specific point rather than the beginning of time.

```typescript
streams: {
  charges: {
    write_disposition: "append",
    incremental: {
      cursor_field: "created",
      initial_value: "1704067200",  // 2024-01-01 UTC
    },
  },
},
```

Pass `--full-refresh` to `otter load` to clear the stored cursor and restart from
`initial_value` (or the beginning if none is set).

```bash
otter load stripe.customers --strategy merge --unique-key id
otter load stripe.charges
```

## Example

```typescript
// otter.config.ts
import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: { dev: { target: { kind: "postgres", url: process.env.PG_URL ?? "" } } },
  sources: {
    stripe: {
      kind: "stripe",
      options: { apiKey: process.env.STRIPE_API_KEY },
    },
  },
  modelsDir: "models",
  sourcesDir: "sources",
});
```

Related: [sources.md](sources.md#source-interface),
[configuration.md](configuration.md#sourceconfig), [cli.md](cli.md#load),
[materializations.md](materializations.md#incremental).
