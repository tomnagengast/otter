import { Glob } from "bun";
import type { Config } from "./config.ts";
import { buildDag, type Dag, type DagNode, toposort } from "./dag.ts";
import { type SqlFragment, withRecording } from "./sql.ts";

export interface Manifest {
  generated_at: string;
  nodes: Record<string, DagNode & { compiled_sql: string }>;
  order: string[];
}

export async function compileProject(config: Config, cwd: string): Promise<Manifest> {
  const glob = new Glob("**/*.sql.ts");
  const files: string[] = [];
  for await (const f of glob.scan(`${cwd}/${config.modelsDir}`)) files.push(f);

  const nodes: DagNode[] = [];
  for (const f of files) {
    const id = f.replace(/\.sql\.ts$/, "").replaceAll("/", "_");
    const ctx = {
      deps: new Set<string>(),
      sources: new Set<string>(),
      seeds: new Set<string>(),
      currentModel: id,
    };
    const mod = await withRecording(ctx, async () => {
      return (await import(`${cwd}/${config.modelsDir}/${f}`)) as {
        default: SqlFragment;
        config?: DagNode["config"];
      };
    });
    nodes.push({
      id,
      path: `${config.modelsDir}/${f}`,
      config: mod.config ?? { materialized: "view" },
      sql: mod.default.__sql,
      deps: [...ctx.deps],
      sources: [...ctx.sources],
      seeds: [...ctx.seeds],
    });
  }

  const dag: Dag = buildDag(nodes);
  const order = toposort(dag);

  const manifestNodes: Manifest["nodes"] = {};
  for (const id of order) {
    // biome-ignore lint/style/noNonNullAssertion: ids in order are guaranteed to be in dag
    const n = dag.get(id)!;
    manifestNodes[id] = { ...n, compiled_sql: n.sql };
  }
  return { generated_at: new Date().toISOString(), nodes: manifestNodes, order };
}
