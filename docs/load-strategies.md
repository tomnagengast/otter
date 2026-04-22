# Load Strategies

`otter load` streams batches from a source into the target's raw schema. The `--strategy` flag
controls how each batch is written.

## `append`

```bash
otter load stripe_pg.charges --strategy append
```

Default. Inserts new rows without touching existing rows. Per-batch SQL:

```sql
INSERT INTO "<schema>"."<source>_<stream>" (<cols>) VALUES …
```

Safe for idempotent replays only if the source guarantees monotonic cursors — otherwise you will
get duplicates.

## `merge`

```bash
otter load stripe_pg.charges --strategy merge --unique-key id
```

Upserts on `unique_key`. Per-batch SQL (Postgres adapter):

```sql
INSERT INTO "<schema>"."<source>_<stream>" (<cols>) VALUES …
ON CONFLICT (<unique_key>) DO UPDATE SET <cols-except-unique_key> = EXCLUDED.<col>
```

`--unique-key` is required; otter throws `merge requires unique_key` if omitted. Adapters without
native upsert should raise `NotSupportedError`.

## `replace`

```bash
otter load stripe_pg.charges --strategy replace
```

Drops the target table, then appends each batch:

```sql
DROP TABLE IF EXISTS "<schema>"."<source>_<stream>";
-- then for each batch:
INSERT INTO "<schema>"."<source>_<stream>" (<cols>) VALUES …
```

Use for small lookup tables or full refreshes.

## Strategy × Adapter Support

| Strategy  | [adapter-postgres](adapter-postgres.md) |
| --------- | :-------------------------------------: |
| `append`  |                    ✔                    |
| `merge`   |                    ✔                    |
| `replace` |                    ✔                    |

Adapters that do not implement a strategy should raise `NotSupportedError` from `bulkLoad`.

## Example

```bash
# Full refresh of a small table.
otter load stripe_pg.plans --strategy replace

# Incremental, keyed by id.
otter load stripe_pg.charges --strategy merge --unique-key id

# Append-only event log.
otter load events_ch.events --strategy append
```

Related: [cli.md](cli.md#load), [adapter-postgres.md](adapter-postgres.md#load-strategies),
[adapters.md](adapters.md#capability-matrix).
