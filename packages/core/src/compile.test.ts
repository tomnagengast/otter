import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Adapter } from "./adapter.ts";
import { compileProject } from "./compile.ts";
import { defineConfig } from "./config.ts";

const stubAdapter: Adapter = {
  kind: "postgres",
  schema: "public",
  async introspect() {
    return { tables: [] };
  },
  async bulkLoad() {
    return { rows: 0, duration_ms: 0 };
  },
  async execute() {
    return { duration_ms: 0 };
  },
  async swap() {},
  async close() {},
};

test("compiles a two-model project and records ref edge", async () => {
  const dir = mkdtempSync(join(tmpdir(), "otter-test-"));
  try {
    mkdirSync(`${dir}/models`);
    writeFileSync(`${dir}/models/a.sql`, `{{ config(materialized: "table") }}\nselect 1\n`);
    writeFileSync(
      `${dir}/models/b.sql`,
      `{{ config(materialized: "view") }}\nselect * from {{ ref("a") }}\n`,
    );

    const config = defineConfig({
      profiles: { dev: { target: stubAdapter } },
      sources: {},
      modelsDir: "models",
    });
    const manifest = await compileProject(config, dir);
    expect(manifest.order).toEqual(["a", "b"]);
    const nodeB = manifest.nodes.b;
    expect(nodeB).toBeDefined();
    const nodeBDefined = nodeB as NonNullable<typeof nodeB>;
    expect(nodeBDefined.deps).toEqual(["a"]);
    expect(nodeBDefined.compiled_sql).toContain(`"a"`);
    expect(nodeBDefined.compiled_sql).not.toContain("{{");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("defaults to materialized: view when config block is omitted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "otter-test-"));
  try {
    mkdirSync(`${dir}/models`);
    writeFileSync(`${dir}/models/a.sql`, `select 1\n`);
    const config = defineConfig({
      profiles: { dev: { target: stubAdapter } },
      sources: {},
      modelsDir: "models",
    });
    const manifest = await compileProject(config, dir);
    expect(manifest.nodes.a?.config.materialized).toBe("view");
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("records source() dependency as sourceName.stream", async () => {
  const dir = mkdtempSync(join(tmpdir(), "otter-test-"));
  try {
    mkdirSync(`${dir}/models`);
    writeFileSync(
      `${dir}/models/s.sql`,
      `{{ config(materialized: "view") }}\nselect * from {{ source("stripe_pg", "charges") }}\n`,
    );
    const config = defineConfig({
      profiles: { dev: { target: stubAdapter } },
      sources: {},
      modelsDir: "models",
    });
    const manifest = await compileProject(config, dir);
    expect(manifest.nodes.s?.sources).toEqual(["stripe_pg.charges"]);
    expect(manifest.nodes.s?.compiled_sql).toContain(`"raw_stripe_pg_charges"`);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("preserves tags and unique_key from config block", async () => {
  const dir = mkdtempSync(join(tmpdir(), "otter-test-"));
  try {
    mkdirSync(`${dir}/models`);
    writeFileSync(
      `${dir}/models/fct.sql`,
      `{{ config(materialized: "incremental", unique_key: "id", tags: ["nightly"]) }}\nselect 1 as id\n`,
    );
    const config = defineConfig({
      profiles: { dev: { target: stubAdapter } },
      sources: {},
      modelsDir: "models",
    });
    const manifest = await compileProject(config, dir);
    const node = manifest.nodes.fct;
    expect(node?.config.materialized).toBe("incremental");
    expect(node?.config.unique_key).toBe("id");
    expect(node?.config.tags).toEqual(["nightly"]);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
