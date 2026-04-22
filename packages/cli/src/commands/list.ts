import { loadConfig, readManifest } from "@otter/core";
import { defineCommand } from "../argv.ts";

export const listCommand = defineCommand({
  name: "list",
  summary: "List registered models / sources / seeds",
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
      const manifest = await readManifest(`${cwd}/.otter/target/manifest.json`);
      for (const id of manifest.order) console.log(id);
      return 0;
    }
    if (kind === "seeds") return 0;
    console.error(`usage: otter list <models|sources|seeds>`);
    return 1;
  },
});
