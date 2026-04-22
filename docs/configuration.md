# Configuration

Otter is configured through a single `otter.config.ts` file at the project root. The file exports
a `defineConfig(...)` call that declares profiles, sources, and where models live on disk.

## Table of Contents

- [File Location](#file-location)
- [defineConfig](#defineconfig)
- [Config Fields](#config-fields)
- [ProfileConfig](#profileconfig)
- [SourceConfig](#sourceconfig)
- [TargetConfig](#targetconfig)
- [Environment Variables](#environment-variables)
- [Example](#example)

## File Location

`otter.config.ts` must sit at the root of the project you invoke `otter` from. The CLI resolves
the file relative to `process.cwd()` and uses dynamic `import(...)` to load it.

## defineConfig

```typescript
// otter.config.ts
import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: { dev: { target: { kind: "postgres", url: process.env.PG_URL ?? "" } } },
  sources: { stripe_pg: { kind: "postgres", url: process.env.SOURCE_PG_URL ?? "" } },
  modelsDir: "models",
});
```

`defineConfig` is a type-only identity helper — it does not transform the value. Its purpose is to
anchor inference on the `Config` type.

## Config Fields

| Field        | Type                            | Default     | Description                                                                                                                      |
| ------------ | ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`   | `Record<string, ProfileConfig>` | —           | Named target environments; one is selected per command via `--profile`                                                           |
| `sources`    | `Record<string, SourceConfig>`  | —           | Named extraction inputs; empty `{}` if you do not use `otter load`                                                               |
| `modelsDir`  | `string`                        | —           | Directory containing `.sql` model files                                                                                          |
| `seedsDir`   | `string`                        | `"seeds"`   | Directory containing seed CSV files (empty CSVs are tolerated)                                                                   |
| `sourcesDir` | `string`                        | `"sources"` | Directory containing `defineSource()` `.ts` files that declare streams (`write_disposition`, `primary_key`, `incremental`, etc.) |

## ProfileConfig

```typescript
interface ProfileConfig {
  target: TargetConfig;
}
```

Profiles are selected per-command with `--profile <name>` (default `dev`). See
[profiles.md](profiles.md).

## SourceConfig

```typescript
interface SourceConfig {
  kind: "postgres" | "clickhouse" | "stripe" | string;
  url?: string;
  options?: Record<string, unknown>;
}
```

`kind` determines which source driver is loaded via `await import("@otter/source-" + kind)`.
Connection-string drivers (Postgres, ClickHouse) read `url`; API-style drivers (Stripe) read
`options`. See [sources.md](sources.md) and the per-driver pages
([source-postgres.md](source-postgres.md), [source-clickhouse.md](source-clickhouse.md),
[source-stripe.md](source-stripe.md)).

## TargetConfig

```typescript
interface TargetConfig {
  kind: "postgres";
  url: string;
  schema?: string;
}
```

`kind` determines which adapter is loaded via `await import("@otter/adapter-" + kind)`. v1 only
ships `postgres`. `schema` controls the default schema for materialized models (default:
`analytics`); the raw schema for `otter load` defaults to `raw`. See
[adapter-postgres.md](adapter-postgres.md).

## Environment Variables

Bun auto-loads `.env` files, so `process.env.PG_URL` is populated without `dotenv`. See
[environment.md](environment.md) for the conventions otter configs and tests use.

## Example

A realistic config with two profiles and two sources:

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
    prod: {
      target: {
        kind: "postgres",
        url: process.env.PROD_PG_URL ?? "",
        schema: "analytics",
      },
    },
  },
  sources: {
    stripe_pg: { kind: "postgres", url: process.env.STRIPE_PG_URL ?? "" },
    events_ch: { kind: "clickhouse", url: process.env.CLICKHOUSE_URL ?? "" },
  },
  modelsDir: "models",
});
```
