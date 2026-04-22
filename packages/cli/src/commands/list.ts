import { type Config, discoverSeeds, loadConfig, loadSourceDefinitions } from "@otter/core";
import { defineCommand } from "../argv.ts";
import { readCompiledManifest } from "../manifest.ts";

export const listCommand = defineCommand({
  name: "list",
  summary: "List registered models / sources / seeds",
  usage: "[models|sources|seeds]",
  flags: {},
  async run({ positionals }) {
    const [kind] = positionals;
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    if (kind === "sources") {
      for (const line of await sourceLines(cwd, config)) console.log(line);
      return 0;
    }
    if (kind === "models") {
      for (const line of await modelLines(cwd)) console.log(line);
      return 0;
    }
    if (kind === "seeds") {
      for (const line of await seedLines(cwd, config)) console.log(line);
      return 0;
    }
    if (kind === undefined) {
      const [seeds, sources, models] = await Promise.all([
        seedLines(cwd, config),
        sourceLines(cwd, config),
        modelLines(cwd),
      ]);
      printGroup("seeds", seeds);
      printGroup("sources", sources, { leadingBlank: seeds.length > 0 });
      printGroup("models", models, { leadingBlank: seeds.length + sources.length > 0 });
      return 0;
    }
    console.error(`usage: otter list [models|sources|seeds]`);
    return 1;
  },
});

async function sourceLines(cwd: string, config: Config): Promise<string[]> {
  const definitions = await loadSourceDefinitions(cwd, config.sourcesDir ?? "sources");
  const lines: string[] = [];
  for (const name of Object.keys(config.sources)) {
    const streams = definitions[name]?.streams;
    if (!streams || Object.keys(streams).length === 0) {
      lines.push(name);
      continue;
    }
    for (const [stream, cfg] of Object.entries(streams)) {
      const bits: string[] = [cfg.write_disposition ?? "append"];
      if (cfg.primary_key) {
        bits.push(
          `pk=${Array.isArray(cfg.primary_key) ? cfg.primary_key.join(",") : cfg.primary_key}`,
        );
      }
      if (cfg.incremental?.cursor_field) bits.push(`cursor=${cfg.incremental.cursor_field}`);
      lines.push(`${name}.${stream}\t${bits.join(" ")}`);
    }
  }
  return lines;
}

async function modelLines(cwd: string): Promise<string[]> {
  const manifest = await readCompiledManifest(cwd, "list");
  return [...manifest.order];
}

async function seedLines(cwd: string, config: Config): Promise<string[]> {
  const seeds = await discoverSeeds(cwd, config.seedsDir ?? "seeds");
  return seeds.map((s) => `${s.name}\t${s.file}`);
}

function printGroup(label: string, lines: string[], opts: { leadingBlank?: boolean } = {}) {
  if (lines.length === 0) return;
  if (opts.leadingBlank) console.log("");
  console.log(`${label}`);
  for (const line of lines) console.log(` - ${line}`);
}
