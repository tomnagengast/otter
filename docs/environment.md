# Environment

Otter is a Bun-native CLI. Bun auto-loads `.env` files from the working directory, so every
`process.env.*` lookup in `otter.config.ts` is populated without `dotenv`.

## Supported Variables

Otter itself reads no environment variables — it uses whatever your `otter.config.ts` references
via `process.env.*`. The table below lists the variables the test suite, example, and default
drivers commonly expect.

| Variable              | Used by                              | Purpose                            |
| --------------------- | ------------------------------------ | ---------------------------------- |
| `PG_URL`              | Sample `otter.config.ts` in the docs | Postgres target connection string  |
| `DEV_PG_URL`          | `examples/basic/otter.config.ts`     | Dev Postgres target                |
| `PROD_PG_URL`         | Sample multi-profile configs         | Prod Postgres target               |
| `STRIPE_PG_URL`       | Sample sources                       | Upstream Postgres source           |
| `CLICKHOUSE_URL`      | Sample ClickHouse source             | Upstream ClickHouse HTTP endpoint  |
| `PG_TEST_URL`         | `bun run test:e2e`                   | Postgres integration-test target   |
| `CLICKHOUSE_TEST_URL` | `bun run test:e2e`                   | ClickHouse integration-test source |

Pick your own variable names — otter does not care, as long as `otter.config.ts` reads them.

## `.env` Files

Bun resolves `.env*` files in the following order (later files override earlier):

1. `.env`
2. `.env.production` / `.env.development` / `.env.test` (chosen by `NODE_ENV`)
3. `.env.local`
4. `.env.<NODE_ENV>.local`

`examples/basic/.env.development` demonstrates the pattern for the Docker-hosted test target:

```
DEV_PG_URL=postgres://postgres:otter@localhost:55432/postgres
```

Because Bun loads these automatically, invoking `otter build` from the directory containing the
file is enough — no extra flags required.

## `$PATH` Setup

While otter is distributed via Bun workspace, add it to `$PATH` with `bun link`:

```bash
cd packages/cli
bun link           # inside the CLI package
bun link @otter/cli   # inside any consumer project (optional)
otter --version
```

After publishing to npm, `bunx @otter/cli` or a global `bun add -g` will work without a
workspace.

Related: [profiles.md](profiles.md), [source-postgres.md](source-postgres.md),
[source-clickhouse.md](source-clickhouse.md).
