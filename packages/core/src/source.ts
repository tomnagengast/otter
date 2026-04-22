export type Row = Record<string, unknown>;

export interface CursorState {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
}

export interface Source {
  kind: string;
  extract(stream: string, state: CursorState): AsyncIterable<Row[]>;
  close(): Promise<void>;
}

export async function resolveSource(kind: string): Promise<{
  createSource: (config: { url: string }) => Source;
}> {
  return import(`@otter/source-${kind}`);
}
