import { mkdirSync } from "node:fs";
import {
  type Config,
  compileProject,
  type LoadStrategy,
  loadConfig,
  openState,
  type ProfileConfig,
  resolveAdapter,
  resolveSource,
  type StateStore,
} from "@otter/core";
import { defineCommand } from "../argv.ts";

export const loadCommand = defineCommand({
  name: "load",
  summary: "Extract from sources into the target",
  usage: "[flags] [<source>.<stream>]",
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

    const strategy = values.strategy as LoadStrategy;
    const uniqueKey = values["unique-key"] as string | undefined;

    const [streamRef] = positionals;
    const streams = streamRef ? [parseStreamRef(streamRef)] : await discoverStreams(config, cwd);
    if (streams.length === 0) {
      console.error("no streams to load: pass <source>.<stream> or add source() refs to models");
      return 1;
    }

    mkdirSync(`${cwd}/.otter`, { recursive: true });
    const state = openState(`${cwd}/.otter/state.db`);

    try {
      for (const { sourceName, stream } of streams) {
        await loadStream({
          cwd,
          config,
          profile,
          sourceName,
          stream,
          strategy,
          uniqueKey,
          state,
        });
      }
      return 0;
    } finally {
      state.close();
    }
  },
});

interface LoadStreamOpts {
  cwd: string;
  config: Config;
  profile: ProfileConfig;
  sourceName: string;
  stream: string;
  strategy: LoadStrategy;
  uniqueKey?: string;
  state: StateStore;
}

async function loadStream(opts: LoadStreamOpts): Promise<void> {
  const { config, profile, sourceName, stream, strategy, uniqueKey, state } = opts;
  const sourceConfig = config.sources[sourceName];
  if (!sourceConfig) throw new Error(`unknown source: ${sourceName}`);

  const cursorState = {
    get: (key: string) => state.getCursor(sourceName, key),
    set: (key: string, value: string) => state.setCursor(sourceName, key, value),
  };

  const { createSource } = await resolveSource(sourceConfig.kind);
  const { createAdapter } = await resolveAdapter(profile.target.kind);
  const src = createSource(sourceConfig);
  const adapter = createAdapter(profile.target);
  const target = {
    schema: profile.target.schema ?? "raw",
    name: `raw_${sourceName}_${stream.replaceAll(".", "_")}`,
  };

  const started = performance.now();
  try {
    const result = await adapter.bulkLoad(target, src.extract(stream, cursorState), strategy, {
      uniqueKey,
    });
    console.log(
      `loaded ${result.rows} rows into ${target.schema}.${target.name} in ${Math.round(performance.now() - started)}ms`,
    );
  } finally {
    await src.close();
    await adapter.close();
  }
}

function parseStreamRef(streamRef: string): { sourceName: string; stream: string } {
  const dot = streamRef.indexOf(".");
  if (dot <= 0 || dot === streamRef.length - 1) {
    throw new Error(`invalid stream ref: ${streamRef}`);
  }
  return { sourceName: streamRef.slice(0, dot), stream: streamRef.slice(dot + 1) };
}

async function discoverStreams(
  config: Config,
  cwd: string,
): Promise<Array<{ sourceName: string; stream: string }>> {
  const manifest = await compileProject(config, cwd);
  const seen = new Set<string>();
  const out: Array<{ sourceName: string; stream: string }> = [];
  for (const node of Object.values(manifest.nodes)) {
    for (const ref of node.sources) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      out.push(parseStreamRef(ref));
    }
  }
  return out;
}
