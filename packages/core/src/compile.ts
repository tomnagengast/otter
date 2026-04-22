import { Glob } from "bun";
import type { Config } from "./config.ts";
import { buildDag, type Dag, type DagNode, toposort } from "./dag.ts";
import { compileTemplate } from "./template.ts";

export interface Manifest {
  generated_at: string;
  nodes: Record<string, DagNode & { compiled_sql: string }>;
  order: string[];
}

export async function compileProject(config: Config, cwd: string): Promise<Manifest> {
  const glob = new Glob("**/*.sql");
  const files: string[] = [];
  for await (const f of glob.scan(`${cwd}/${config.modelsDir}`)) files.push(f);

  const nodes: DagNode[] = [];
  const seen = new Map<string, string>();
  for (const f of files) {
    const base = f.split("/").pop() ?? f;
    const id = base.replace(/\.sql$/, "");
    const prior = seen.get(id);
    if (prior !== undefined) {
      throw new Error(`duplicate model id "${id}": ${prior} and ${f}`);
    }
    seen.set(id, f);
    const path = `${config.modelsDir}/${f}`;
    const body = await Bun.file(`${cwd}/${path}`).text();
    const compiled = compileTemplate(body, id);
    nodes.push({
      id,
      path,
      config: compiled.config,
      sql: compiled.sql,
      deps: [...compiled.deps],
      sources: [...compiled.sources],
      seeds: [...compiled.seeds],
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
