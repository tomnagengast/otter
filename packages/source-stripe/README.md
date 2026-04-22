# @otter/source-stripe

Stripe API source for Otter. Paginates `v1/<resource>` list endpoints, tracks an incremental
cursor on `created`, and lands top-level scalars as typed Postgres columns with nested
objects/arrays as `jsonb`.

## Configuration

```typescript
// otter.config.ts (excerpt)
sources: {
  stripe: {
    kind: "stripe",
    options: {
      apiKey: process.env.STRIPE_API_KEY,
    },
  },
},
```

| Option          | Type     | Default                  | Description                             |
| --------------- | -------- | ------------------------ | --------------------------------------- |
| `apiKey`        | `string` | `STRIPE_API_KEY`         | Secret key. Required unless set in env. |
| `apiVersion`    | `string` | `2025-04-30.basil`       | Pinned `Stripe-Version` header.         |
| `stripeAccount` | `string` | —                        | Sets `Stripe-Account` for Connect apps. |
| `pageSize`      | `number` | `100`                    | List `limit` per request (1–100).       |
| `baseUrl`       | `string` | `https://api.stripe.com` | Override for test servers.              |

## Streams

The stream name is the Stripe resource. Declare which ones to load in `sources/stripe.ts`:

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
    subscriptions: {
      write_disposition: "merge",
      primary_key: "id",
      incremental: { cursor_field: "created" },
    },
  },
});
```

Use `identifier` to override the URL path (e.g. nested endpoints):

```typescript
streams: {
  subscription_items: {
    identifier: "subscription_items",
    incremental: { cursor_field: "created" },
  },
},
```

## Extract Behavior

- `GET /v1/<stream>?limit=<pageSize>[&starting_after=<id>][&created[gt]=<cursor>]`
- Paginates via `starting_after` until `has_more` is false.
- Stores the max `created` (unix seconds) per stream in `.otter/state.db`.
- Infers column types from the first page: scalars typed, nested values → `jsonb` (serialized
  as JSON strings on the wire).
- Retries 429 and 5xx responses up to 5 times, honoring `Retry-After` when present.

## Incremental

`cursor_field` defaults to `created` when not set. State stores a unix timestamp; the next run
sends `created[gt]=<cursor>`.

Related: [docs/source-stripe.md](../../docs/source-stripe.md),
[docs/sources.md](../../docs/sources.md).
