## Otter ELT Tool Design Discussion (358569a2-47d3-44a9-a16b-2c19aee2928a)

`/Users/tom/repos/local/tomnagengast/otter/.worktrees/dev`

- Hybrid 5-package monorepo split chosen (`@otter/core`, `@otter/cli`, `@otter/adapter-postgres`, `@otter/source-postgres`, `@otter/source-clickhouse`) with zero-dep CLI via `node:util` `parseArgs` and hand-rolled adjacency-list DAG
- Config-as-TypeScript (`defineConfig`) and `.sql.ts` tagged-template models with recording `ref`/`source` stubs; artifacts under `.otter/target/` with internal `EventEmitter` → `run_results.json` + `events.jsonl` observability
