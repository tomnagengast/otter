import { mkdirSync } from "node:fs";
import {
  type Config,
  compileProject,
  type LoadStrategy,
  loadConfig,
  loadSourceDefinitions,
  openState,
  type ProfileConfig,
  resolveStream,
  type SourceDefinition,
  type StateStore,
  type StreamConfig,
  type WriteDisposition,
} from "@otter-sh/core";
import { defineCommand } from "../argv.ts";
import { count, duration, rel, SEP, status } from "../ui.ts";

export const loadCommand = defineCommand({
  name: "load",
  summary: "Extract from sources into the target",
  usage: "[flags] [<source>.<stream>]",
  flags: {
    profile: { type: "string", default: "dev" },
    strategy: { type: "string" },
    "unique-key": { type: "string" },
    "full-refresh": { type: "boolean" },
  },
  async run({ values, positionals }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const profile = config.profiles[values.profile as string];
    if (!profile) throw new Error(`unknown profile: ${values.profile}`);

    const definitions = await loadSourceDefinitions(cwd, config.sourcesDir ?? "sources");
    const fullRefresh = Boolean(values["full-refresh"]);
    const strategyFlag = (
      fullRefresh ? "replace" : (values.strategy as LoadStrategy | undefined)
    ) as LoadStrategy | undefined;
    const uniqueKeyFlag = values["unique-key"] as string | undefined;

    const [streamRef] = positionals;
    const streams = streamRef
      ? [parseStreamRef(streamRef)]
      : await discoverStreams(config, definitions, cwd);
    if (streams.length === 0) {
      console.error(
        "no streams to load: declare one in sources/*.ts or reference source() in a model",
      );
      return 1;
    }

    mkdirSync(`${cwd}/.otter`, { recursive: true });
    const state = openState(`${cwd}/.otter/state.db`);

    const usedSources = new Set<string>();
    try {
      for (const { sourceName, stream } of streams) {
        usedSources.add(sourceName);
        await loadStream({
          cwd,
          config,
          profile,
          sourceName,
          stream,
          streamConfig: resolveStream(definitions, sourceName, stream),
          strategyFlag,
          uniqueKeyFlag,
          fullRefresh,
          state,
        });
      }
      return 0;
    } finally {
      state.close();
      for (const name of usedSources) {
        const src = config.sources[name];
        if (src) await src.close();
      }
      await profile.target.close();
    }
  },
});

interface LoadStreamOpts {
  cwd: string;
  config: Config;
  profile: ProfileConfig;
  sourceName: string;
  stream: string;
  streamConfig: StreamConfig | undefined;
  strategyFlag?: LoadStrategy;
  uniqueKeyFlag?: string;
  fullRefresh?: boolean;
  state: StateStore;
}

async function loadStream(opts: LoadStreamOpts): Promise<void> {
  const { config, profile, sourceName, stream, streamConfig, state } = opts;
  const src = config.sources[sourceName];
  if (!src) throw new Error(`unknown source: ${sourceName}`);
  const adapter = profile.target;

  const strategy = resolveStrategy(opts.strategyFlag, streamConfig?.write_disposition);
  const uniqueKey = opts.uniqueKeyFlag ?? normalizePrimaryKey(streamConfig?.primary_key);
  if (strategy === "merge" && !uniqueKey) {
    throw new Error(
      `${sourceName}.${stream}: merge requires primary_key in sources/${sourceName}.ts or --unique-key`,
    );
  }

  const cursorField = streamConfig?.incremental?.cursor_field;
  if (opts.fullRefresh && cursorField) {
    state.clearCursor(sourceName, `${stream}:${cursorField}`);
  }

  const cursorState = {
    get: (key: string) => state.getCursor(sourceName, key),
    set: (key: string, value: string) => state.setCursor(sourceName, key, value),
  };

  const target = {
    schema: adapter.schema,
    name: `raw_${sourceName}_${stream.replaceAll(".", "_")}`,
  };

  const extractOpts = {
    cursorField,
    initialValue: streamConfig?.incremental?.initial_value,
    schema: streamConfig?.schema,
    identifier: streamConfig?.identifier,
  };

  const started = performance.now();
  const { columnTypes, rows } = await src.extract(stream, cursorState, extractOpts);
  const result = await adapter.bulkLoad(target, rows, strategy, { uniqueKey, columnTypes });
  console.log(
    status(
      "done",
      rel(target.name, target.schema),
      `${count(result.rows, "rows")} ${SEP} ${duration(performance.now() - started)}`,
    ),
  );
}

function resolveStrategy(
  flag: LoadStrategy | undefined,
  declared: WriteDisposition | undefined,
): LoadStrategy {
  return flag ?? declared ?? "append";
}

function normalizePrimaryKey(pk: string | string[] | undefined): string | undefined {
  if (!pk) return undefined;
  if (Array.isArray(pk)) {
    if (pk.length === 0) return undefined;
    if (pk.length > 1) {
      throw new Error(`composite primary_key not yet supported: [${pk.join(", ")}]`);
    }
    return pk[0];
  }
  return pk;
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
  definitions: Record<string, SourceDefinition>,
  cwd: string,
): Promise<Array<{ sourceName: string; stream: string }>> {
  const seen = new Set<string>();
  const out: Array<{ sourceName: string; stream: string }> = [];
  for (const [sourceName, def] of Object.entries(definitions)) {
    for (const stream of Object.keys(def.streams)) {
      const key = `${sourceName}.${stream}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ sourceName, stream });
    }
  }
  const manifest = await compileProject(config, cwd);
  for (const node of Object.values(manifest.nodes)) {
    for (const ref of node.sources) {
      if (seen.has(ref)) continue;
      seen.add(ref);
      out.push(parseStreamRef(ref));
    }
  }
  return out;
}
