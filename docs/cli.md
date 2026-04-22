# CLI Reference

Every workflow starts with the `otter` binary. All commands read `otter.config.ts` from the current
working directory and write artifacts under `.otter/`.

## Table of Contents

- [Synopsis](#synopsis)
- [Commands](#commands)
- [load](#load)
- [compile](#compile)
- [build](#build)
- [list](#list)
- [show](#show)
- [clean](#clean)
- [Common Flags](#common-flags)

## Synopsis

```
otter <command> [flags]
otter --help
otter --version
```

All commands resolve `otter.config.ts` from the current working directory.

## Commands

| Command               | Summary                                                     |
| --------------------- | ----------------------------------------------------------- |
| [`load`](#load)       | Extract from a source and load into the target's raw schema |
| [`compile`](#compile) | Resolve refs/sources and emit manifest + per-model SQL      |
| [`build`](#build)     | Execute the compiled DAG against the target                 |
| [`list`](#list)       | Enumerate models, sources, or seeds                         |
| [`show`](#show)       | Preview rows from a materialized model                      |
| [`clean`](#clean)     | Remove `.otter/target/` and `.otter/compiled/` artifacts    |

## load

```
otter load [--profile <name>] [--strategy append|merge|replace] [--unique-key <col>] <source>.<stream>
```

Extracts rows from `<source>.<stream>` and writes them into the target's raw schema as
`<schema>.<source>_<stream>` (default raw schema: `raw`).

| Flag           | Type   | Default  | Description                                    |
| -------------- | ------ | -------- | ---------------------------------------------- |
| `--profile`    | string | `dev`    | Profile key from `otter.config.ts`             |
| `--strategy`   | string | `append` | Load strategy: `append`, `merge`, or `replace` |
| `--unique-key` | string | —        | Required for `merge`; column used for upsert   |

```bash
otter load stripe_pg.charges --strategy merge --unique-key id
```

See [load-strategies.md](load-strategies.md) for strategy semantics and
[source-postgres.md](source-postgres.md) / [source-clickhouse.md](source-clickhouse.md) for
per-driver behavior.

## compile

```
otter compile [--profile <name>]
```

Reads every `.sql` file under `modelsDir`, records `ref` / `source` / `seed` edges, and writes
`.otter/target/manifest.json` plus one rendered file per model under `.otter/compiled/`
(mirroring the source path, e.g. `models/staging/stg_users.sql` →
`.otter/compiled/models/staging/stg_users.sql`). No target I/O.

```bash
otter compile
```

See [state.md](state.md#manifest) for the manifest shape and [models.md](models.md) for model
authoring.

## build

```
otter build [--profile <name>] [-s <selector>] [--seed]
```

Reads the compiled manifest and executes every selected node topologically.

| Flag           | Type    | Default | Description                                        |
| -------------- | ------- | ------- | -------------------------------------------------- |
| `--profile`    | string  | `dev`   | Profile key from `otter.config.ts`                 |
| `-s, --select` | string  | —       | Selector expression (e.g. `+model`, `tag:nightly`) |
| `--seed`       | boolean | `false` | Run seeds only; skip model execution               |

```bash
otter build
otter build -s +dim_users
otter build -s tag:nightly
```

On completion, writes `.otter/target/run_results.json` and appends to
`.otter/target/events.jsonl`. See [selectors.md](selectors.md) and
[materializations.md](materializations.md).

## list

```
otter list <models|sources|seeds>
```

Enumerates one category.

- `models` — node ids from `.otter/target/manifest.json` (run `otter compile` first).
- `sources` — keys from `config.sources`.
- `seeds` — files discovered under `seedsDir`.

```bash
otter list models
otter list sources
```

## show

```
otter show [--profile <name>] [--limit <n>] <model>
```

Runs `select * from <schema>.<model> limit <n>` against the target and prints the rows.
Requires a compiled manifest from `otter compile` and a previously materialized relation from
`otter build`.

| Flag        | Type   | Default | Description                        |
| ----------- | ------ | ------- | ---------------------------------- |
| `--profile` | string | `dev`   | Profile key from `otter.config.ts` |
| `--limit`   | string | `10`    | Row count                          |

```bash
otter show stg_users --limit 20
```

## clean

```
otter clean
```

Removes `.otter/target/` and `.otter/compiled/` (manifest, run results, events log, per-model
compiled SQL). Preserves `.otter/state.db` so source cursors survive clean.

```bash
otter clean
```

## Common Flags

Otter recognizes the following globally:

| Flag              | Description                         |
| ----------------- | ----------------------------------- |
| `-h`, `--help`    | Show help for the root or a command |
| `-V`, `--version` | Print the CLI version               |

Command-specific flags are documented in each command section above.
