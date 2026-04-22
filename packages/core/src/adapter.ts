import type { Row } from "./source.ts";

export interface TableRef {
  schema: string;
  name: string;
}

export interface LoadResult {
  rows: number;
  duration_ms: number;
}

export interface ExecuteResult {
  rows_affected?: number;
  rows?: Row[];
  duration_ms: number;
}

export type LoadStrategy = "append" | "merge" | "replace";

export class NotSupportedError extends Error {}

export interface MergeIncrementalOpts {
  staging: TableRef;
  final: TableRef;
  compiledSql: string;
  uniqueKey: string;
}

export interface Adapter {
  kind: string;
  introspect(): Promise<{ tables: TableRef[] }>;
  bulkLoad(
    target: TableRef,
    rows: AsyncIterable<Row[]>,
    strategy: LoadStrategy,
    opts?: { uniqueKey?: string; columnTypes?: Record<string, string> },
  ): Promise<LoadResult>;
  execute(sql: string): Promise<ExecuteResult>;
  swap(staging: TableRef, final: TableRef): Promise<void>;
  /** Optional: build staging from compiledSql, merge into final, drop staging. */
  mergeIncremental?(opts: MergeIncrementalOpts): Promise<void>;
  close(): Promise<void>;
}

export async function resolveAdapter(kind: string): Promise<{
  createAdapter: (config: { url: string; schema?: string }) => Adapter;
}> {
  return import(`@otter/adapter-${kind}`);
}
