# Profiles

A profile is a named target environment. Every otter command selects a profile and runs against
its adapter.

## Declaring Profiles

Profiles are declared under `config.profiles` in `otter.config.ts`. Each key is a profile name and
each value is a `ProfileConfig` whose only field today is `target` — an `Adapter` produced by a
factory from an `@otter/adapter-*` package.

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter/adapter-postgres";
import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: {
    dev: {
      target: postgresAdapter({ url: process.env.PG_URL ?? "", schema: "analytics" }),
    },
    prod: {
      target: postgresAdapter({ url: process.env.PROD_PG_URL ?? "", schema: "analytics" }),
    },
  },
  sources: {},
  modelsDir: "models",
});
```

## Selecting a Profile

Every command accepts `--profile <name>`. The default is `dev`.

```bash
otter build --profile prod
otter show stg_users --profile prod --limit 20
```

If the profile name does not exist in `config.profiles`, the command exits with
`unknown profile: <name>`.

## Target Resolution

When a command runs, otter:

1. Loads `otter.config.ts` (which in turn imports and calls the adapter factory).
2. Reads `profiles[values.profile].target` — the already-instantiated `Adapter`.
3. Uses `adapter.schema` as the default schema for materialization and `search_path`.

See [adapters.md](adapters.md#adapter-interface) for the `Adapter` contract and
[adapter-postgres.md](adapter-postgres.md) for the only driver shipped today.

## Example

A two-profile setup for dev and production, with sources that both profiles share.

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter/adapter-postgres";
import { defineConfig } from "@otter/core";
import { postgresSource } from "@otter/source-postgres";

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
  },
  modelsDir: "models",
});
```

```bash
otter compile
otter build                  # runs against dev
otter build --profile prod   # runs against prod
```

Related: [configuration.md](configuration.md#profileconfig), [cli.md](cli.md),
[environment.md](environment.md), [adapter-postgres.md](adapter-postgres.md).
