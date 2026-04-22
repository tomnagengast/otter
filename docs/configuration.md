# Configuration

Otter is configured through a single `otter.config.ts` file at the project root. The file exports
a `defineConfig(...)` call that declares profiles, sources, and where models live on disk.

Projects install sources and adapters as explicit dependencies, then import their factories in the
config file. There is no runtime driver-by-name lookup — the packages you import determine the
capabilities your project has.

## Table of Contents

- [File Location](#file-location)
- [Project Dependencies](#project-dependencies)
- [defineConfig](#defineconfig)
- [Config Fields](#config-fields)
- [ProfileConfig](#profileconfig)
- [Sources](#sources)
- [Targets](#targets)
- [Environment Variables](#environment-variables)
- [Example](#example)

## File Location

`otter.config.ts` must sit at the root of the project you invoke `otter` from. The CLI resolves
the file relative to `process.cwd()` and uses dynamic `import(...)` to load it.

## Project Dependencies

Add the sources and adapters you use to your project's `package.json` alongside `@otter-sh/cli`:

```json
{
  "dependencies": {
    "@otter-sh/core": "^0.1.1",
    "@otter-sh/adapter-postgres": "^0.1.1",
    "@otter-sh/source-postgres": "^0.1.1",
    "@otter-sh/source-clickhouse": "^0.1.1",
    "@otter-sh/source-stripe": "^0.1.1"
  },
  "devDependencies": {
    "@otter-sh/cli": "^0.1.1"
  }
}
```

## defineConfig

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter-sh/adapter-postgres";
import { defineConfig } from "@otter-sh/core";
import { postgresSource } from "@otter-sh/source-postgres";

export default defineConfig({
  profiles: {
    dev: { target: postgresAdapter({ url: process.env.PG_URL ?? "" }) },
  },
  sources: {
    stripe_pg: postgresSource({ url: process.env.SOURCE_PG_URL ?? "" }),
  },
  modelsDir: "models",
});
```

`defineConfig` is a type-only identity helper — it does not transform the value. Its purpose is to
anchor inference on the `Config` type.

## Config Fields

| Field        | Type                            | Default     | Description                                                                                                                      |
| ------------ | ------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`   | `Record<string, ProfileConfig>` | —           | Named target environments; one is selected per command via `--profile`                                                           |
| `sources`    | `Record<string, Source>`        | —           | Named extraction inputs; empty `{}` if you do not use `otter load`                                                               |
| `modelsDir`  | `string`                        | —           | Directory containing `.sql` model files                                                                                          |
| `seedsDir`   | `string`                        | `"seeds"`   | Directory containing seed CSV files (empty CSVs are tolerated)                                                                   |
| `sourcesDir` | `string`                        | `"sources"` | Directory containing `defineSource()` `.ts` files that declare streams (`write_disposition`, `primary_key`, `incremental`, etc.) |

## ProfileConfig

```typescript
interface ProfileConfig {
  target: Adapter;
}
```

Profiles are selected per-command with `--profile <name>` (default `dev`). The `target` is an
`Adapter` instance produced by a factory from an `@otter-sh/adapter-*` package. See
[profiles.md](profiles.md).

## Sources

Each entry in `sources` is a `Source` instance produced by a factory from an `@otter-sh/source-*`
package. Factories take driver-specific options (typed per package):

```typescript
import { postgresSource } from "@otter-sh/source-postgres";
import { clickhouseSource } from "@otter-sh/source-clickhouse";
import { stripeSource } from "@otter-sh/source-stripe";

sources: {
  customers_pg: postgresSource({ url: process.env.SOURCE_PG_URL ?? "" }),
  events_ch: clickhouseSource({ url: process.env.CLICKHOUSE_URL ?? "" }),
  billing: stripeSource({ apiKey: process.env.STRIPE_API_KEY }),
}
```

See [sources.md](sources.md) and the per-driver pages ([source-postgres.md](source-postgres.md),
[source-clickhouse.md](source-clickhouse.md), [source-stripe.md](source-stripe.md)).

## Targets

Each `profiles[*].target` is an `Adapter` instance. v1 only ships `postgresAdapter` from
`@otter-sh/adapter-postgres`:

```typescript
import { postgresAdapter } from "@otter-sh/adapter-postgres";

profiles: {
  dev: {
    target: postgresAdapter({
      url: process.env.PG_URL ?? "",
      schema: "analytics",
    }),
  },
}
```

`schema` controls the default schema for materialized models and the raw schema for
`otter load` (both use the same schema — configure a second profile if you need to separate them).
Defaults to `"public"`. See [adapter-postgres.md](adapter-postgres.md).

## Environment Variables

Bun auto-loads `.env` files, so `process.env.PG_URL` is populated without `dotenv`. See
[environment.md](environment.md) for the conventions otter configs and tests use.

## Example

A realistic config with two profiles and two sources:

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter-sh/adapter-postgres";
import { defineConfig } from "@otter-sh/core";
import { clickhouseSource } from "@otter-sh/source-clickhouse";
import { postgresSource } from "@otter-sh/source-postgres";

export default defineConfig({
  profiles: {
    dev: {
      target: postgresAdapter({
        url: process.env.PG_URL ?? "postgres://localhost:5432/dev",
        schema: "analytics",
      }),
    },
    prod: {
      target: postgresAdapter({
        url: process.env.PROD_PG_URL ?? "",
        schema: "analytics",
      }),
    },
  },
  sources: {
    stripe_pg: postgresSource({ url: process.env.STRIPE_PG_URL ?? "" }),
    events_ch: clickhouseSource({ url: process.env.CLICKHOUSE_URL ?? "" }),
  },
  modelsDir: "models",
});
```
