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
  duration_ms: number;
}

export type LoadStrategy = "append" | "merge" | "replace";

export class NotSupportedError extends Error {}

export interface Adapter {
  kind: string;
  introspect(): Promise<{ tables: TableRef[] }>;
  bulkLoad(
    target: TableRef,
    rows: AsyncIterable<Row[]>,
    strategy: LoadStrategy,
    opts?: { uniqueKey?: string },
  ): Promise<LoadResult>;
  execute(sql: string): Promise<ExecuteResult>;
  swap(staging: TableRef, final: TableRef): Promise<void>;
  close(): Promise<void>;
}

export async function resolveAdapter(kind: string): Promise<{
  createAdapter: (config: { url: string; schema?: string }) => Adapter;
}> {
  return import(`@otter/adapter-${kind}`);
}
