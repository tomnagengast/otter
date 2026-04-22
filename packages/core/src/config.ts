export type TargetKind = "postgres";
export type SourceKind = "postgres" | "clickhouse";

export interface TargetConfig {
  kind: TargetKind;
  url: string;
  schema?: string;
}

export interface SourceConfig {
  kind: SourceKind;
  url: string;
}

export interface ProfileConfig {
  target: TargetConfig;
}

export interface Config {
  profiles: Record<string, ProfileConfig>;
  sources: Record<string, SourceConfig>;
  modelsDir: string;
  seedsDir?: string;
}

export function defineConfig(config: Config): Config {
  return config;
}

export async function loadConfig(cwd: string): Promise<Config> {
  const path = `${cwd}/otter.config.ts`;
  const mod = (await import(path)) as { default: Config };
  if (!mod.default) throw new Error(`otter.config.ts at ${path} has no default export`);
  return mod.default;
}
