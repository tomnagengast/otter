export type Row = Record<string, unknown>;

export interface CursorState {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export interface ExtractOpts {
  /** Column to filter on / track the high-water mark for incremental loads. */
  cursorField?: string;
  /** Lower bound for the cursor when state has no prior value. */
  initialValue?: string;
  /** Optional upstream schema (e.g. postgres namespace). */
  schema?: string;
  /** Optional upstream identifier when it differs from `stream`. */
  identifier?: string;
}

export interface Source {
  kind: string;
  extract(stream: string, state: CursorState, opts?: ExtractOpts): AsyncIterable<Row[]>;
  close(): Promise<void>;
}

export async function resolveSource(kind: string): Promise<{
  createSource: (config: { url: string }) => Source;
}> {
  return import(`@otter/source-${kind}`);
}
