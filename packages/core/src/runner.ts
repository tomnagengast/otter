import type { Adapter } from "./adapter.ts";
import type { Manifest } from "./compile.ts";
import { buildDag, toposort } from "./dag.ts";
import { OtterEmitter } from "./events.ts";
import { evaluate } from "./selector/evaluate.ts";
import { parseSelector } from "./selector/parse.ts";

export interface RunBuildOpts {
  manifest: Manifest;
  adapter: Adapter;
  selector?: string;
  schema: string;
}

export interface RunResults {
  nodes: Record<string, { status: "success" | "error"; duration_ms: number; error?: string }>;
}

export async function runBuild(opts: RunBuildOpts): Promise<{
  results: RunResults;
  emitter: OtterEmitter;
}> {
  const emitter = new OtterEmitter();
  const dag = buildDag(Object.values(opts.manifest.nodes));
  const order = toposort(dag);
  const included = opts.selector ? evaluate(parseSelector(opts.selector), dag) : new Set(order);
  const results: RunResults = { nodes: {} };
  for (const id of order) {
    if (!included.has(id)) continue;
    const node = dag.get(id);
    if (!node) continue;
    const started = performance.now();
    emitter.emitNode({ type: "node.start", id, ts: new Date().toISOString() });
    try {
      const staging = { schema: opts.schema, name: `${id}__stg` };
      const final = { schema: opts.schema, name: id };
      if (node.config.materialized === "view") {
        await opts.adapter.execute(
          `create or replace view "${final.schema}"."${final.name}" as ${node.sql}`,
        );
      } else {
        await opts.adapter.execute(
          `create table "${staging.schema}"."${staging.name}" as ${node.sql}`,
        );
        await opts.adapter.swap(staging, final);
      }
      const duration_ms = performance.now() - started;
      results.nodes[id] = { status: "success", duration_ms };
      emitter.emitNode({ type: "node.finish", id, ts: new Date().toISOString(), duration_ms });
    } catch (err) {
      const duration_ms = performance.now() - started;
      const msg = err instanceof Error ? err.message : String(err);
      results.nodes[id] = { status: "error", duration_ms, error: msg };
      emitter.emitNode({
        type: "node.error",
        id,
        ts: new Date().toISOString(),
        duration_ms,
        error: msg,
      });
      throw err;
    }
  }
  return { results, emitter };
}
