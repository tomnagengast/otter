import { loadConfig } from "@otter-sh/core";
import { defineCommand } from "../argv.ts";
import { readCompiledManifest } from "../manifest.ts";
import { theme } from "../ui.ts";

export const showCommand = defineCommand({
  name: "show",
  summary: "Preview rows from a materialized model",
  usage: "[flags] <model>",
  flags: { profile: { type: "string", default: "dev" }, limit: { type: "string", default: "10" } },
  async run({ values, positionals }) {
    const [model] = positionals;
    if (!model) throw new Error("usage: otter show <model>");
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const profileName = values.profile as string;
    const profile = config.profiles[profileName];
    if (!profile) throw new Error(`unknown profile: ${profileName}`);
    const manifest = await readCompiledManifest(cwd, "show");
    if (!manifest.nodes[model]) throw new Error(`unknown model: ${model}`);
    const adapter = profile.target;
    const schema = adapter.schema;
    const limit = Number(values.limit);
    const result = await adapter.execute(`select * from "${schema}"."${model}" limit ${limit}`);
    if (result.rows && result.rows.length > 0) console.table(result.rows);
    else console.log(theme.muted("(no rows)"));
    await adapter.close();
    return 0;
  },
});
