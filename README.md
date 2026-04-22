# Otter

Bun-native ELT tool. Extract from ClickHouse or Postgres, load raw tables into a Postgres target,
compile `.sql.ts` models into a DAG, and run them with `otter build`.

For a runnable Hello World (CSV seeds → models → view), see
[`examples/basic`](examples/basic/README.md).

## Quickstart

```bash
bun install
cd packages/cli && bun link

otter compile
otter build
otter show <model> --limit 10
```

See [docs/getting-started.md](docs/getting-started.md) for a full walkthrough.

## Why Otter

- TypeScript models (`.sql.ts`) with `sql`, `ref`, `source`, and `seed` helpers — no Jinja.
- Bun-native runtime: `Bun.sql`, `bun:sqlite`, `Bun.file`. No `pg`, `postgres.js`,
  `better-sqlite3`.
- Single-binary CLI with six commands: `load`, `compile`, `build`, `list`, `show`, `clean`.
- Selectors cover ancestors (`+model`), descendants (`model+`), tags (`tag:nightly`), and set
  operations.

## Coming from dbt

| dbt                       | Otter                                                |
| ------------------------- | ---------------------------------------------------- |
| `dbt_project.yml`         | `otter.config.ts`                                    |
| `.sql` + Jinja            | `.sql.ts` with `` sql`…` ``, `ref`, `source`, `seed` |
| `schema.yml`              | Sibling exports in `.sql.ts`                         |
| `target/manifest.json`    | `.otter/target/manifest.json`                        |
| `target/run_results.json` | `.otter/target/run_results.json`                     |
| `dbt run -s tag:nightly`  | `otter build -s tag:nightly`                         |
| `dbt run -s +model`       | `otter build -s +model`                              |
| `dbt run -s model+`       | `otter build -s model+`                              |

## Docs

Start at [docs/README.md](docs/README.md). The reference set covers the CLI, configuration,
models, materializations, sources, adapters, selectors, state, and observability.

## Development

```bash
bun install
bun run ci          # check + typecheck + test

# Integration tests (requires Docker).
bun run test:up
bun run test:e2e
bun run test:down
```

See [docs/packages.md](docs/packages.md) for the workspace layout.
