# Packages

Otter is a Bun monorepo under `packages/`. Each package has a single responsibility and depends
on `@otter-sh/core` for types and runtime plumbing.

## Package Map

| Package                       | Description                                                     | Doc                                          |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------- |
| `@otter-sh/core`              | Config, DAG, compiler, runner, interfaces, state store          | [configuration.md](configuration.md)         |
| `@otter-sh/cli`               | `otter` CLI binary (six commands)                               | [cli.md](cli.md)                             |
| `@otter-sh/adapter-postgres`  | Postgres target adapter (`postgresAdapter`, `Bun.sql`)          | [adapter-postgres.md](adapter-postgres.md)   |
| `@otter-sh/source-postgres`   | Postgres source (`postgresSource`, paginated extract)           | [source-postgres.md](source-postgres.md)     |
| `@otter-sh/source-clickhouse` | ClickHouse source (`clickhouseSource`, HTTP `JSONEachRow`)      | [source-clickhouse.md](source-clickhouse.md) |
| `@otter-sh/source-stripe`     | Stripe source (`stripeSource`, REST pagination, `created` curs) | [source-stripe.md](source-stripe.md)         |

## Consumer Installation

Users' projects declare the sources, adapters, and CLI they need explicitly in `package.json`:

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

Only the packages declared here are available to `otter.config.ts`. There is no magic driver
lookup — the imports in your config determine your capabilities.

## Development Installation

From a clone of this repo:

```bash
bun install
cd packages/cli && bun link
otter --version
```

Then from any consumer project that depends on `@otter-sh/cli` via `workspace:*`, run `bun install`
to link everything.

## Version Compatibility

All packages are pinned to the same workspace version via `bun.lock`. There is no matrix; bump
every package together.

## Adding a New Package

New source or adapter packages don't need to follow any naming convention — the CLI uses the
factory you import in `otter.config.ts`, not the package name. Conventionally we name them
`@otter-sh/source-<kind>` / `@otter-sh/adapter-<kind>` for discoverability.

1. Create the package under `packages/<name>/`.
2. Add a `package.json` with `"dependencies": { "@otter-sh/core": "workspace:*" }`.
3. Export a typed factory function that returns a `Source` or `Adapter`. By convention name it
   `<kind>Source` or `<kind>Adapter`.
4. Run `bun install` to register it in the workspace.

See [sources.md](sources.md#adding-a-source-driver) and
[adapters.md](adapters.md#adding-an-adapter) for interface details.
