# Observability

Otter emits structured events during `otter build`. Every event is published to an
`OtterEmitter` (which extends `EventTarget`) and also appended to
`.otter/target/events.jsonl`.

## Emitter API

```typescript
export interface NodeEvent {
  type: "node.start" | "node.finish" | "node.error";
  id: string; // model id
  ts: string; // ISO 8601 timestamp
  rows?: number; // reserved
  duration_ms?: number; // set on finish/error
  error?: string; // set on error
}

export class OtterEmitter extends EventTarget {
  emitNode(event: NodeEvent): void;
  onNode(handler: (e: NodeEvent) => void): () => void; // returns an unsubscribe fn
}
```

Three event types are emitted today:

| Type          | When                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `node.start`  | Before the adapter starts materializing a model                               |
| `node.finish` | After a successful materialization (`duration_ms` set)                        |
| `node.error`  | After a failed materialization (`duration_ms` set, `error` set, build aborts) |

## Subscribing in Code

Use `OtterEmitter` directly if you drive `runBuild` yourself:

```typescript
import { readManifest, resolveAdapter, runBuild } from "@otter/core";

const adapter = (await resolveAdapter("postgres")).createAdapter({ url: "postgres://…" });
const manifest = await readManifest(".otter/target/manifest.json");

const { emitter, results } = await runBuild({ manifest, adapter, schema: "analytics" });

// Note: the emitter is returned *after* the run completes, so typical usage is to subscribe
// inside your own build wrapper before calling runBuild. The CLI writes the log via
// jsonlAppender at shutdown.
emitter.onNode((e) => {
  if (e.type === "node.error") console.error(e.id, e.error);
});
```

## JSONL Log Shipping

`jsonlAppender(path, emitter)` buffers events and flushes them to a newline-delimited JSON file
when called:

```typescript
import { jsonlAppender, OtterEmitter } from "@otter/core";

const emitter = new OtterEmitter();
const flush = jsonlAppender(".otter/target/events.jsonl", emitter);
// … emit events during a run …
await flush(); // writes the accumulated lines to disk
```

The CLI uses this wiring automatically during `otter build`. Ship the resulting
`events.jsonl` to any log pipeline that understands line-delimited JSON:

```bash
# Tail recent events.
tail -f .otter/target/events.jsonl | jq -c '{id, type, duration_ms, error}'

# Ingest with vector, fluentbit, or your tool of choice by tailing the file.
```

See [state.md](state.md#events-jsonl) for the on-disk shape and
[cli.md](cli.md#build) for how `otter build` writes it.
