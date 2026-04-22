import type { Adapter, TableRef } from "./adapter.ts";
import type { DagNode } from "./dag.ts";

export interface IncrementalOpts {
  node: DagNode;
  target: TableRef;
  cursor: string;
}

export function incrementalPredicate(opts: IncrementalOpts): string {
  const { cursor, target } = opts;
  return `${cursor} > (select coalesce(max(${cursor}), '1970-01-01') from "${target.schema}"."${target.name}")`;
}

export async function nextCursor(
  adapter: Adapter,
  target: TableRef,
  cursor: string,
): Promise<string | undefined> {
  const query = `select max(${cursor}) as v from "${target.schema}"."${target.name}"`;
  void (await adapter.execute(query));
  return undefined;
}
