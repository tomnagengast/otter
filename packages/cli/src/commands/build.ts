import {
  buildDag,
  compileProject,
  discoverSeeds,
  evaluateSelector,
  jsonlAppender,
  loadConfig,
  loadSeeds,
  OtterEmitter,
  parseSelector,
  runBuild,
  runModelTests,
  writeCompiledSql,
  writeManifest,
} from "@otter-sh/core";
import { defineCommand } from "../argv.ts";
import { count, duration, rel, SEP, status, theme } from "../ui.ts";

export const buildCommand = defineCommand({
  name: "build",
  summary: "Compile, seed, build models, and run model tests",
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
    const adapter = profile.target;
    const schema = adapter.schema;

    const manifest = await compileProject(config, cwd);
    await writeManifest(`${cwd}/.otter/target/manifest.json`, manifest);
    await writeCompiledSql(manifest, cwd);
    console.log(`${theme.success("compiled")} ${count(manifest.order.length, "nodes")}`);

    const seedsDir = config.seedsDir ?? "seeds";
    const seeds = await discoverSeeds(cwd, seedsDir);
    if (seeds.length > 0) {
      const { files } = await loadSeeds({ adapter, schema, seeds });
      for (const f of files) {
        console.log(
          status(
            "seed",
            rel(f.name, schema),
            `${count(f.rows, "rows")} ${SEP} ${duration(f.duration_ms)}`,
          ),
        );
      }
    } else if (values.seed) {
      console.log(theme.muted(`no seeds found in ${seedsDir}/`));
    }

    if (values.seed) {
      await adapter.close();
      return 0;
    }

    const emitter = new OtterEmitter();
    const flush = jsonlAppender(`${cwd}/.otter/target/events.jsonl`, emitter);
    emitter.onNode((e) => {
      if (e.type === "node.start") {
        console.log(status("start", rel(e.id, schema)));
      } else if (e.type === "node.finish") {
        console.log(status("done", rel(e.id, schema), duration(e.duration_ms ?? 0)));
      } else if (e.type === "node.error") {
        console.log(status("fail", rel(e.id, schema), theme.error(String(e.error))));
      }
    });

    try {
      const selector = values.select as string | undefined;
      const { results } = await runBuild({
        manifest,
        adapter,
        selector,
        schema,
        emitter,
      });
      await Bun.write(`${cwd}/.otter/target/run_results.json`, JSON.stringify(results));
      const buildFailed = Object.values(results.nodes).some((r) => r.status === "error");
      if (buildFailed) return 1;

      const selected = selector
        ? evaluateSelector(parseSelector(selector), buildDag(Object.values(manifest.nodes)))
        : undefined;
      const { tests } = await runModelTests({
        manifest,
        adapter,
        schema,
        selected,
        emitter: new OtterEmitter(),
      });
      if (tests.length === 0) return 0;

      for (const t of tests) {
        const label = rel(`${t.model}.${t.column}.${t.test}`, schema);
        if (t.status === "pass") {
          console.log(status("pass", label, duration(t.duration_ms)));
        } else if (t.status === "fail") {
          console.log(
            status(
              "fail",
              label,
              `${theme.error(`${t.failures} row(s) failed`)} ${SEP} ${duration(t.duration_ms)}`,
            ),
          );
        } else {
          console.log(
            status(
              "fail",
              label,
              `${theme.error(t.error ?? "error")} ${SEP} ${duration(t.duration_ms)}`,
            ),
          );
        }
      }
      const passed = tests.filter((t) => t.status === "pass").length;
      const failed = tests.length - passed;
      console.log(
        `${theme.muted("tests:")} ${count(passed, "passed")} ${SEP} ${count(failed, "failed")}`,
      );
      await Bun.write(`${cwd}/.otter/target/test_results.json`, JSON.stringify({ tests }));
      return failed > 0 ? 1 : 0;
    } finally {
      await flush();
      await adapter.close();
    }
  },
});
