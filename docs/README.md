# Otter Docs

Otter is a Bun-native ELT tool for managing an analytics stack in TypeScript. Extract from
ClickHouse or Postgres, load raw tables into a Postgres target, and run `.sql` models as a DAG.

## Getting Started

- [getting-started.md](getting-started.md) — install, configure, build your first model.

## Reference

**CLI**

- [cli.md](cli.md) — every command and flag.

**Configuration**

- [configuration.md](configuration.md) — `otter.config.ts`, `defineConfig`, schema of every field.
- [profiles.md](profiles.md) — named target environments.
- [environment.md](environment.md) — `.env` loading and variable conventions.

**Models**

- [models.md](models.md) — `sql`, `ref`, `source`, and model `config`.
- [materializations.md](materializations.md) — `view`, `table`, `incremental` semantics.
- [selectors.md](selectors.md) — selector grammar for `otter build -s`.

**Sources**

- [sources.md](sources.md) — `Source` interface and driver resolution.
- [source-postgres.md](source-postgres.md) — Postgres source driver.
- [source-clickhouse.md](source-clickhouse.md) — ClickHouse source driver.

**Adapters**

- [adapters.md](adapters.md) — `Adapter` interface and capability matrix.
- [adapter-postgres.md](adapter-postgres.md) — Postgres target driver.
- [load-strategies.md](load-strategies.md) — `append`, `merge`, `replace`.

**Internals**

- [state.md](state.md) — `.otter/` layout, `state.db`, manifest, run results, events log.
- [observability.md](observability.md) — `OtterEmitter`, `jsonlAppender`, event shapes.
- [packages.md](packages.md) — workspace layout and adding new packages.
