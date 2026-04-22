import { jsonlAppender, loadConfig, readManifest, resolveAdapter, runBuild } from "@otter/core";
import { defineCommand } from "../argv.ts";

export const buildCommand = defineCommand({
  name: "build",
  summary: "Execute the compiled DAG",
  flags: {
    profile: { type: "string", default: "dev" },
    select: { type: "string", short: "s" },
  },
  async run({ values }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const profileName = values.profile as string;
    const profile = config.profiles[profileName];
    if (!profile) throw new Error(`unknown profile: ${profileName}`);
    const manifest = await readManifest(`${cwd}/.otter/target/manifest.json`);
    const { createAdapter } = await resolveAdapter(profile.target.kind);
    const adapter = createAdapter(profile.target);
    const { results, emitter } = await runBuild({
      manifest,
      adapter,
      selector: values.select as string | undefined,
      schema: profile.target.schema ?? "analytics",
    });
    const flush = jsonlAppender(`${cwd}/.otter/target/events.jsonl`, emitter);
    await Bun.write(`${cwd}/.otter/target/run_results.json`, JSON.stringify(results, null, 2));
    await flush();
    await adapter.close();
    return Object.values(results.nodes).some((r) => r.status === "error") ? 1 : 0;
  },
});
