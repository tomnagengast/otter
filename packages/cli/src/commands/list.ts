import { discoverSeeds, loadConfig } from "@otter/core";
import { defineCommand } from "../argv.ts";
import { readCompiledManifest } from "../manifest.ts";

export const listCommand = defineCommand({
  name: "list",
  summary: "List registered models / sources / seeds",
  usage: "<models|sources|seeds>",
  flags: {},
  async run({ positionals }) {
    const [kind] = positionals;
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    if (kind === "sources") {
      for (const name of Object.keys(config.sources)) console.log(name);
      return 0;
    }
    if (kind === "models") {
      const manifest = await readCompiledManifest(cwd, "list");
      for (const id of manifest.order) console.log(id);
      return 0;
    }
    if (kind === "seeds") {
      const seeds = await discoverSeeds(cwd, config.seedsDir ?? "seeds");
      for (const s of seeds) console.log(`${s.name}\t${s.file}`);
      return 0;
    }
    console.error(`usage: otter list <models|sources|seeds>`);
    return 1;
  },
});
