import { mkdirSync } from "node:fs";
import { loadConfig, openState, resolveAdapter, resolveSource } from "@otter/core";
import { defineCommand } from "../argv.ts";

export const loadCommand = defineCommand({
  name: "load",
  summary: "Extract from sources into the target",
  flags: {
    profile: { type: "string", default: "dev" },
    strategy: { type: "string", default: "append" },
    "unique-key": { type: "string" },
  },
  async run({ values, positionals }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const profile = config.profiles[values.profile as string];
    if (!profile) throw new Error(`unknown profile: ${values.profile}`);
    const [streamRef] = positionals;
    if (!streamRef) throw new Error("usage: otter load <source>.<stream>");
    const [sourceName, stream] = streamRef.split(".");
    if (!sourceName || !stream) throw new Error(`invalid stream ref: ${streamRef}`);
    const sourceConfig = config.sources[sourceName];
    if (!sourceConfig) throw new Error(`unknown source: ${sourceName}`);

    // Ensure .otter/ directory exists for state.db.
    mkdirSync(`${cwd}/.otter`, { recursive: true });
    const state = openState(`${cwd}/.otter/state.db`);
    const cursorState = {
      get: (key: string) => state.getCursor(sourceName, key),
      set: (key: string, value: string) => state.setCursor(sourceName, key, value),
    };

    const { createSource } = await resolveSource(sourceConfig.kind);
    const { createAdapter } = await resolveAdapter(profile.target.kind);
    const src = createSource(sourceConfig);
    const adapter = createAdapter(profile.target);

    const started = performance.now();
    const target = { schema: profile.target.schema ?? "raw", name: `${sourceName}_${stream}` };
    const result = await adapter.bulkLoad(
      target,
      src.extract(stream, cursorState),
      values.strategy as "append" | "merge" | "replace",
      { uniqueKey: values["unique-key"] as string | undefined },
    );
    await src.close();
    await adapter.close();
    state.close();
    console.log(
      `loaded ${result.rows} rows into ${target.schema}.${target.name} in ${Math.round(performance.now() - started)}ms`,
    );
    return 0;
  },
});
