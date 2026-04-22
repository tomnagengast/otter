# otter

Bun-native ELT tool. Extract from ClickHouse or Postgres, load raw tables into a local Postgres
target, compile `.sql.ts` models into a DAG, and run them with `otter build`.

## Quickstart

```bash
# Install
cd packages/cli && bun link

# Set up your config
cat > otter.config.ts << 'EOF'
import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: {
    dev: { target: { kind: "postgres", url: process.env.PG_DEV_URL ?? "" } },
  },
  sources: {
    stripe_pg: { kind: "postgres", url: process.env.SOURCE_PG_URL ?? "" },
  },
  modelsDir: "models",
});
EOF

# Write a model
mkdir -p models
cat > models/charges.sql.ts << 'EOF'
import { sql, source } from "@otter/core";

export const config = { materialized: "table" } as const;
export default sql`select * from ${source("stripe_pg", "charges")}`;
EOF

# Load raw data from source into target
otter load stripe_pg.charges --strategy replace

# Compile the DAG
otter compile

# Run the DAG
otter build

# Inspect
otter list models
otter show charges --limit 5
```

## Commands

| Command                               | Description                                     |
| ------------------------------------- | ----------------------------------------------- |
| `otter load <source>.<stream>`        | Extract from source, load into target raw table |
| `otter compile`                       | Resolve refs/sources, build DAG, write manifest |
| `otter build [-s selector]`           | Topo-execute the compiled DAG                   |
| `otter list <models\|sources\|seeds>` | Enumerate registered entities                   |
| `otter show <model>`                  | Preview post-transform rows                     |
| `otter clean`                         | Remove `.otter/target/`                         |

### Load strategies

- `append` — insert new rows, keep existing rows
- `replace` — drop and recreate the target table
- `merge --unique-key <col>` — upsert on the given key column

### Selectors (`otter build -s`)

| Syntax               | Meaning                        |
| -------------------- | ------------------------------ |
| `model_name`         | Exact model match              |
| `+model_name`        | Model + all ancestors          |
| `model_name+`        | Model + all descendants        |
| `tag:nightly`        | All models tagged `nightly`    |
| `a b`                | Union (space-separated)        |
| `+model,tag:nightly` | Intersection (comma-separated) |

## Development

```bash
bun install
bun run ci          # check + typecheck + test

# Integration tests (requires Docker)
bun run test:up
bun run test:e2e
bun run test:down
```

## Packages

| Package                    | Description                               |
| -------------------------- | ----------------------------------------- |
| `@otter/core`              | Config, DAG, compiler, runner, interfaces |
| `@otter/cli`               | `otter` CLI binary                        |
| `@otter/adapter-postgres`  | Postgres target adapter (`Bun.sql`)       |
| `@otter/source-postgres`   | Postgres source (paginated extract)       |
| `@otter/source-clickhouse` | ClickHouse source (HTTP streaming)        |
