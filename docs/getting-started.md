# Getting Started

Install otter, write a config, and run your first load + build against a local Postgres target.

## Prerequisites

- Bun ≥ 1.3.11.
- A Postgres instance to use as the target (a Docker container or a local install is fine).
- Optionally, a second Postgres database to use as a source for `otter load`.

## Install

Otter is distributed as a Bun workspace. From a clone of the repo:

```bash
bun install
cd packages/cli && bun link
otter --version
```

After `bun link` the `otter` binary is available on your `$PATH`. See
[packages.md](packages.md) for the workspace layout.

## First Project

Create a project directory with an `otter.config.ts` at its root and a `models/` directory next to
it.

Add the packages your project needs as dependencies in `package.json`:

```json
{
  "dependencies": {
    "@otter-sh/core": "^0.1.1",
    "@otter-sh/adapter-postgres": "^0.1.1",
    "@otter-sh/source-postgres": "^0.1.1"
  },
  "devDependencies": {
    "@otter-sh/cli": "^0.1.1"
  }
}
```

Then write your config by importing the factories you need:

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

```sql
-- models/stg_users.sql
{{ config(
  materialized: "table"
) }}

select id, email, created_at from {{ source("stripe_pg", "users") }}
```

Bun auto-loads any `.env` file in the project root, so drop `PG_URL` and `SOURCE_PG_URL` in
`.env` and they will be available to `otter` without `dotenv`. See
[environment.md](environment.md).

## Load Raw Data

Pull rows from the source into the target's raw schema.

```bash
otter load stripe_pg.users --strategy replace
```

- The raw table lands at `raw.stripe_pg_users`.
- See [cli.md](cli.md#load) for all `load` options and
  [load-strategies.md](load-strategies.md) for strategy semantics.

## Compile and Build

Resolve `ref`/`source` calls into a DAG, then execute it topologically.

```bash
otter compile
otter build
```

- `otter compile` writes `.otter/target/manifest.json`.
- `otter build` executes every node, producing `.otter/target/run_results.json` and
  `.otter/target/events.jsonl`. See [state.md](state.md).
- To select a subset, pass `-s`: `otter build -s +stg_users`. See
  [selectors.md](selectors.md).

## Next Steps

- Add more models and try the three materializations: [materializations.md](materializations.md).
- Inspect a model: `otter show stg_users --limit 20`.
- Wire multiple environments with [profiles.md](profiles.md).
- Tune extraction with [source-postgres.md](source-postgres.md) or
  [source-clickhouse.md](source-clickhouse.md).
