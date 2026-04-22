# @otter/source-clickhouse

ClickHouse source for `otter`. Implements the `Source` interface from `@otter/core` using the
ClickHouse HTTP interface with `FORMAT JSONEachRow`. Streams rows via `fetch` in batches of 5 000
— no native ClickHouse client dependency.

See [../../docs/source-clickhouse.md](../../docs/source-clickhouse.md) for full documentation.

## Install

Currently distributed via Bun workspace. See [../../docs/packages.md](../../docs/packages.md).
