# @otter-sh/cli

The `otter` CLI — a Bun-native ELT tool for extracting from sources, loading into Postgres, and
running `.sql` models as a DAG. Think "dbt-shaped workflow, no Python, no Jinja runtime, no
`pg`/`postgres.js`/`better-sqlite3`."

Six commands: `load`, `compile`, `build`, `list`, `show`, `clean`.

## Install

```bash
bun add -D @otter-sh/cli
```

Run the CLI:

```bash
bun x otter --help
# or, after `bun link` in a clone of the repo:
otter --help
```

`@otter-sh/cli` pulls in [`@otter-sh/core`](https://www.npmjs.com/package/@otter-sh/core) and
dynamically imports `@otter-sh/adapter-<kind>` / `@otter-sh/source-<kind>` packages based on your
`otter.config.ts`, so add the adapter and sources you actually use:

```bash
bun add @otter-sh/adapter-postgres
bun add @otter-sh/source-postgres    # or source-clickhouse / source-stripe
```

Requires Bun — the packages import `"bun"` and `"bun:sqlite"` at runtime.

## Quickstart

```typescript
// otter.config.ts
import { postgresAdapter } from "@otter-sh/adapter-postgres";
import { defineConfig } from "@otter-sh/core";
import { postgresSource } from "@otter-sh/source-postgres";

export default defineConfig({
  profiles: {
    dev: {
      target: postgresAdapter({
        url: process.env.PG_URL ?? "postgres://localhost:5432/dev",
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

```sql
-- models/stg_users.sql
{{ config(materialized="table") }}

select id, email, created_at
from {{ source("stripe_pg", "users") }}
```

```bash
otter load stripe_pg.users --strategy merge --unique-key id
otter compile
otter build
otter show stg_users --limit 10
```

## Commands

| Command   | Summary                                                     |
| --------- | ----------------------------------------------------------- |
| `load`    | Extract from a source and load into the target's raw schema |
| `compile` | Resolve `ref`/`source`/`seed`; emit manifest + rendered SQL |
| `build`   | Execute the compiled DAG against the target                 |
| `list`    | Enumerate models, sources, or seeds                         |
| `show`    | Preview rows from a materialized model                      |
| `clean`   | Remove `.otter/target/` and `.otter/compiled/` artifacts    |

### `otter load`

```
otter load [--profile <name>] [--strategy <append|merge|replace>] \
           [--unique-key <col>] [--full-refresh] [<source>.<stream>]
```

Extracts from `<source>.<stream>` into `<raw_schema>.raw_<source>_<stream>`. When omitted,
discovers streams from `sourcesDir/*.ts` (`defineSource`) and from `source()` references in
compiled models. `--strategy` falls back to the stream's declared `write_disposition`, then to
`append`. `--full-refresh` is a shortcut for `--strategy replace` that also clears the stream's
incremental cursor from `.otter/state.db`.

### `otter compile`

```
otter compile [--profile <name>]
```

Reads every `.sql` under `modelsDir`, records `ref`/`source`/`seed` edges, and writes
`.otter/target/manifest.json` plus one rendered file per model under `.otter/compiled/`. No
target I/O.

### `otter build`

```
otter build [--profile <name>] [-s <selector>] [--seed]
```

Compiles, loads CSV seeds from `seedsDir/`, executes every selected node topologically, and
runs column tests declared in `{{ config(columns: { ... }) }}` blocks. Selectors support
ancestors (`+model`), descendants (`model+`), tags (`tag:nightly`), and set operations. Writes
`.otter/target/run_results.json`, `.otter/target/test_results.json`, and appends
`.otter/target/events.jsonl`.

### `otter list`

```
otter list [models|sources|seeds]
```

Enumerates one category, or all three when called without an argument.

### `otter show`

```
otter show [--profile <name>] [--limit <n>] <model>
```

Runs `select * from <schema>.<model> limit <n>`. Requires `otter compile` first and a
previously built relation.

### `otter clean`

```
otter clean
```

Removes `.otter/target/` and `.otter/compiled/`. Preserves `.otter/state.db`.

## Coming from dbt

| dbt                       | Otter                                                                 |
| ------------------------- | --------------------------------------------------------------------- |
| `dbt_project.yml`         | `otter.config.ts`                                                     |
| `.sql` + Jinja            | `.sql` with `{{ config }}`, `{{ ref }}`, `{{ source }}`, `{{ seed }}` |
| `schema.yml`              | Inline `{{ config(...) }}` block                                      |
| `target/manifest.json`    | `.otter/target/manifest.json`                                         |
| `target/run_results.json` | `.otter/target/run_results.json`                                      |
| `dbt run -s tag:nightly`  | `otter build -s tag:nightly`                                          |
| `dbt run -s +model`       | `otter build -s +model`                                               |
| `dbt run -s model+`       | `otter build -s model+`                                               |

## Full documentation

- CLI reference — [cli.md](https://github.com/tomnagengast/otter/blob/main/docs/cli.md)
- Getting started —
  [getting-started.md](https://github.com/tomnagengast/otter/blob/main/docs/getting-started.md)
- Config — [configuration.md](https://github.com/tomnagengast/otter/blob/main/docs/configuration.md)
- Models / materializations / selectors / state —
  [docs index](https://github.com/tomnagengast/otter/blob/main/docs/README.md)

## License

MIT
