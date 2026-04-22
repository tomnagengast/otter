export interface DagNode {
  id: string;
  path: string;
  config: { materialized: "view" | "table" | "incremental"; unique_key?: string; tags?: string[] };
  sql: string;
  deps: string[];
  sources: string[];
}

export type Dag = Map<string, DagNode>;

export function buildDag(nodes: DagNode[]): Dag {
  const dag = new Map<string, DagNode>();
  for (const n of nodes) dag.set(n.id, n);
  for (const n of nodes) {
    for (const d of n.deps) {
      if (!dag.has(d)) throw new Error(`${n.id} refs unknown model: ${d}`);
    }
  }
  return dag;
}

export function toposort(dag: Dag): string[] {
  const indeg = new Map<string, number>();
  for (const n of dag.values()) indeg.set(n.id, 0);
  for (const n of dag.values()) {
    for (const _d of n.deps) {
      indeg.set(n.id, (indeg.get(n.id) ?? 0) + 1);
    }
  }
  // Kahn's: start with zero-indegree nodes.
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: queue.length > 0 guarantees shift() is defined
    const id = queue.shift()!;
    order.push(id);
    for (const n of dag.values()) {
      if (n.deps.includes(id)) {
        const v = (indeg.get(n.id) ?? 0) - 1;
        indeg.set(n.id, v);
        if (v === 0) queue.push(n.id);
      }
    }
  }
  if (order.length !== dag.size) throw new Error("cycle detected in DAG");
  return order;
}
