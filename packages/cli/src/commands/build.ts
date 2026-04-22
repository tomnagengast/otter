import {
  discoverSeeds,
  jsonlAppender,
  loadConfig,
  loadSeeds,
  OtterEmitter,
  resolveAdapter,
  runBuild,
} from "@otter/core";
import { defineCommand } from "../argv.ts";
import { readCompiledManifest } from "../manifest.ts";

export const buildCommand = defineCommand({
  name: "build",
  summary: "Load seeds and execute the compiled DAG",
  usage: "[flags]",
  flags: {
    profile: { type: "string", default: "dev" },
    select: { type: "string", short: "s" },
    seed: { type: "boolean", default: false },
  },
  async run({ values }) {
    const cwd = process.cwd();
    const config = await loadConfig(cwd);
    const profileName = values.profile as string;
    const profile = config.profiles[profileName];
    if (!profile) throw new Error(`unknown profile: ${profileName}`);
    const manifest = values.seed ? null : await readCompiledManifest(cwd, "build");
    const { createAdapter } = await resolveAdapter(profile.target.kind);
    const schema = profile.target.schema ?? "analytics";
    const adapter = createAdapter({ ...profile.target, schema });

    const seedsDir = config.seedsDir ?? "seeds";
    const seeds = await discoverSeeds(cwd, seedsDir);
    if (seeds.length > 0) {
      const { files } = await loadSeeds({ adapter, schema, seeds });
      for (const f of files) {
        console.log(`seeded ${schema}.${f.name} (${f.rows} rows, ${Math.round(f.duration_ms)}ms)`);
      }
    } else if (values.seed) {
      console.log(`no seeds found in ${seedsDir}/`);
    }

    if (values.seed) {
      await adapter.close();
      return 0;
    }
    if (!manifest) throw new Error("internal error: build manifest missing");

    const emitter = new OtterEmitter();
    const flush = jsonlAppender(`${cwd}/.otter/target/events.jsonl`, emitter);
    emitter.onNode((e) => {
      if (e.type === "node.start") {
        console.log(`building ${schema}.${e.id}`);
      } else if (e.type === "node.finish") {
        console.log(`built ${schema}.${e.id} (${Math.round(e.duration_ms ?? 0)}ms)`);
      } else if (e.type === "node.error") {
        console.log(`failed ${schema}.${e.id}: ${e.error}`);
      }
    });

    try {
      const { results } = await runBuild({
        manifest,
        adapter,
        selector: values.select as string | undefined,
        schema,
        emitter,
      });
      await Bun.write(`${cwd}/.otter/target/run_results.json`, JSON.stringify(results, null, 2));
      return Object.values(results.nodes).some((r) => r.status === "error") ? 1 : 0;
    } finally {
      await flush();
      await adapter.close();
    }
  },
});
