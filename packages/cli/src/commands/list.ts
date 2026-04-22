import { type Config, discoverSeeds, loadConfig, loadSourceDefinitions } from "@otter-sh/core";
import { defineCommand } from "../argv.ts";
import { readCompiledManifest } from "../manifest.ts";
import { BULLET, DASH, SEP, theme } from "../ui.ts";

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
      const group = renderGroup("sources", await sourceItems(cwd, config));
      if (group) console.log(group);
      return 0;
    }
    if (kind === "models") {
      const group = renderGroup("models", await modelItems(cwd));
      if (group) console.log(group);
      return 0;
    }
    if (kind === "seeds") {
      const group = renderGroup("seeds", await seedItems(cwd, config));
      if (group) console.log(group);
      return 0;
    }
    if (kind === undefined) {
      const [seeds, sources, models] = await Promise.all([
        seedItems(cwd, config),
        sourceItems(cwd, config),
        modelItems(cwd),
      ]);
      const groups = [
        renderGroup("seeds", seeds),
        renderGroup("sources", sources),
        renderGroup("models", models),
      ].filter((g) => g.length > 0);
      if (groups.length > 0) console.log(groups.join("\n\n"));
      return 0;
    }

    console.error(`usage: otter list [models|sources|seeds]`);
    return 1;
  },
});

interface Item {
  name: string;
  meta?: string;
}

async function sourceItems(cwd: string, config: Config): Promise<Item[]> {
  const definitions = await loadSourceDefinitions(cwd, config.sourcesDir ?? "sources");
  const out: Item[] = [];
  for (const name of Object.keys(config.sources)) {
    const streams = definitions[name]?.streams;
    if (!streams || Object.keys(streams).length === 0) {
      out.push({ name });
      continue;
    }
    for (const [stream, cfg] of Object.entries(streams)) {
      const bits: string[] = [theme.warn(cfg.write_disposition ?? "append")];
      if (cfg.primary_key) {
        const pk = Array.isArray(cfg.primary_key) ? cfg.primary_key.join(",") : cfg.primary_key;
        bits.push(`${theme.pk("pk")}${theme.muted("=")}${theme.info(pk)}`);
      }
      if (cfg.incremental?.cursor_field) {
        bits.push(
          `${theme.cursor("cursor")}${theme.muted("=")}${theme.info(cfg.incremental.cursor_field)}`,
        );
      }
      out.push({ name: `${name}.${stream}`, meta: bits.join(` ${SEP} `) });
    }
  }
  return out;
}

async function modelItems(cwd: string): Promise<Item[]> {
  const manifest = await readCompiledManifest(cwd, "list");
  return [...manifest.order].map((name) => ({ name }));
}

async function seedItems(cwd: string, config: Config): Promise<Item[]> {
  const seeds = await discoverSeeds(cwd, config.seedsDir ?? "seeds");
  return seeds.map((s) => ({ name: s.name, meta: theme.info(s.file) }));
}

function renderGroup(label: string, items: Item[]): string {
  if (items.length === 0) return "";
  const lines = items.map((i) => {
    const name = theme.bold(i.name);
    return i.meta ? `  ${BULLET} ${name} ${DASH} ${i.meta}` : `  ${BULLET} ${name}`;
  });
  return `${theme.heading(label)}\n${lines.join("\n")}`;
}
