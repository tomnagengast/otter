import { existsSync } from "node:fs";
import { Glob } from "bun";

export type WriteDisposition = "append" | "merge" | "replace";

export interface IncrementalConfig {
  cursor_field: string;
  initial_value?: string;
}

export interface StreamConfig {
  /** Upstream table name; defaults to the key used in `streams`. */
  identifier?: string;
  /** Upstream schema; sources may interpret this (e.g. postgres namespace). */
  schema?: string;
  description?: string;
  write_disposition?: WriteDisposition;
  primary_key?: string | string[];
  incremental?: IncrementalConfig;
  columns?: Record<string, { description?: string; tests?: string[] }>;
}

export interface SourceDefinition {
  /**
   * Key of the connection entry in `otter.config.ts` `sources`. Defaults to
   * the source's own filename.
   */
  connection?: string;
  description?: string;
  streams: Record<string, StreamConfig>;
}

export function defineSource(def: SourceDefinition): SourceDefinition {
  return def;
}

export async function loadSourceDefinitions(
  cwd: string,
  sourcesDir: string,
): Promise<Record<string, SourceDefinition>> {
  const root = `${cwd}/${sourcesDir}`;
  const out: Record<string, SourceDefinition> = {};
  if (!existsSync(root)) return out;
  const glob = new Glob("*.ts");
  for await (const f of glob.scan(root)) {
    const name = f.replace(/\.ts$/, "");
    const mod = (await import(`${root}/${f}`)) as {
      default?: SourceDefinition;
    };
    if (!mod.default) {
      throw new Error(`${sourcesDir}/${f}: missing default export from defineSource()`);
    }
    out[name] = mod.default;
  }
  return out;
}

export function resolveStream(
  definitions: Record<string, SourceDefinition>,
  sourceName: string,
  stream: string,
): StreamConfig | undefined {
  return definitions[sourceName]?.streams[stream];
}
