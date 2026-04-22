import { loadConfig, readManifest, resolveAdapter } from "@otter/core";
import { defineCommand } from "../argv.ts";

export const showCommand = defineCommand({
  name: "show",
  summary: "Preview rows from a materialized model",
  flags: { profile: { type: "string", default: "dev" }, limit: { type: "string", default: "10" } },
  async run({ values, positionals }) {
    const [model] = positionals;
    if (!model) throw new Error("usage: otter show <model>");
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const profileName = values.profile as string;
    const profile = config.profiles[profileName];
    if (!profile) throw new Error(`unknown profile: ${profileName}`);
    const manifest = await readManifest(`${cwd}/.otter/target/manifest.json`);
    if (!manifest.nodes[model]) throw new Error(`unknown model: ${model}`);
    const { createAdapter } = await resolveAdapter(profile.target.kind);
    const adapter = createAdapter(profile.target);
    const schema = profile.target.schema ?? "analytics";
    const limit = Number(values.limit);
    await adapter.execute(`select * from "${schema}"."${model}" limit ${limit}`);
    await adapter.close();
    return 0;
  },
});
