import { compileProject, loadConfig, writeCompiledSql, writeManifest } from "@otter-sh/core";
import { defineCommand } from "../argv.ts";
import { count, theme } from "../ui.ts";

export const compileCommand = defineCommand({
  name: "compile",
  summary: "Compile models into .otter/target/manifest.json and .otter/compiled/",
  usage: "[flags]",
  flags: { profile: { type: "string", default: "dev" } },
  async run() {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const manifest = await compileProject(config, cwd);
    await writeManifest(`${cwd}/.otter/target/manifest.json`, manifest);
    await writeCompiledSql(manifest, cwd);
    console.log(`${theme.success("compiled")} ${count(manifest.order.length, "nodes")}`);
    return 0;
  },
});
