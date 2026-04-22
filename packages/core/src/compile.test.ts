import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { compileProject } from "./compile.ts";
import { defineConfig } from "./config.ts";

// Use a tmpdir inside the workspace root so Bun can resolve workspace packages via node_modules.
const WORKSPACE_ROOT = new URL("../../../", import.meta.url).pathname;

test("compiles a two-model project and records ref edge", async () => {
  const dir = mkdtempSync(join(WORKSPACE_ROOT, "otter-test-"));
  try {
    mkdirSync(`${dir}/models`);
    writeFileSync(
      `${dir}/models/a.sql.ts`,
      `import { sql } from "@otter/core"; export const config = { materialized: "table" } as const; export default sql\`select 1\`;`,
    );
    writeFileSync(
      `${dir}/models/b.sql.ts`,
      `import { sql, ref } from "@otter/core"; export const config = { materialized: "view" } as const; export default sql\`select * from \${ref("a")}\`;`,
    );
    writeFileSync(
      `${dir}/otter.config.ts`,
      `import { defineConfig } from "@otter/core"; export default defineConfig({ profiles: { dev: { target: { kind: "postgres", url: "" } } }, sources: {}, modelsDir: "models" });`,
    );

    const config = defineConfig({
      profiles: { dev: { target: { kind: "postgres", url: "" } } },
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
  } finally {
    rmSync(dir, { recursive: true });
  }
});
