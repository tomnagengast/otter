import type { Adapter } from "./adapter.ts";
import type { Source } from "./source.ts";

export interface ProfileConfig {
  target: Adapter;
}

export interface Config {
  profiles: Record<string, ProfileConfig>;
  sources: Record<string, Source>;
  modelsDir: string;
  seedsDir?: string;
  sourcesDir?: string;
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
