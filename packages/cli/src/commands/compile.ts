import { compileProject, loadConfig, writeManifest } from "@otter/core";
import { defineCommand } from "../argv.ts";

export const compileCommand = defineCommand({
  name: "compile",
  summary: "Compile models into .otter/target/manifest.json",
  usage: "[flags]",
  flags: { profile: { type: "string", default: "dev" } },
  async run() {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const manifest = await compileProject(config, cwd);
    await writeManifest(`${cwd}/.otter/target/manifest.json`, manifest);
    console.log(`compiled ${manifest.order.length} nodes`);
    return 0;
  },
});
