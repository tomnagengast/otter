# Packages

Otter is a Bun monorepo under `packages/`. Each package has a single responsibility and depends
on `@otter/core` for types and runtime plumbing.

## Package Map

| Package                    | Description                                            | Doc                                          |
| -------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| `@otter/core`              | Config, DAG, compiler, runner, interfaces, state store | [configuration.md](configuration.md)         |
| `@otter/cli`               | `otter` CLI binary (six commands)                      | [cli.md](cli.md)                             |
| `@otter/adapter-postgres`  | Postgres target adapter (`Bun.sql`)                    | [adapter-postgres.md](adapter-postgres.md)   |
| `@otter/source-postgres`   | Postgres source (paginated extract)                    | [source-postgres.md](source-postgres.md)     |
| `@otter/source-clickhouse` | ClickHouse source (HTTP streaming, `JSONEachRow`)      | [source-clickhouse.md](source-clickhouse.md) |

## Installation

Otter is currently consumed via Bun workspace links. From a clone of the repo:

```bash
bun install
cd packages/cli && bun link
otter --version
```

Per-package npm publishing is not shipped yet. When it is, `bun add @otter/cli` will resolve all
transitive adapter and source packages.

## Version Compatibility

All packages are pinned to the same workspace version via `bun.lock`. There is no matrix; bump
every package together.

## Adding a New Package

New source or adapter packages follow the naming convention `@otter/source-<kind>` /
`@otter/adapter-<kind>` so `resolveSource` and `resolveAdapter` in `@otter/core` find them by
dynamic import.

1. Create the package under `packages/<name>/`.
2. Add a `package.json` with `"name": "@otter/<name>"` and `"dependencies": { "@otter/core": "workspace:*" }`.
3. Export `createSource` (for sources) or `createAdapter` (for adapters).
4. Run `bun install` to register it in the workspace.

See [sources.md](sources.md#adding-a-source-driver) and
[adapters.md](adapters.md#adding-an-adapter) for interface details.
