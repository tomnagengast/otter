import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readManifest, writeManifest } from "./manifest.ts";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "otter-core-manifest-"));
}

test("writeManifest creates parent directories and round-trips the manifest", async () => {
  const cwd = tempDir();
  const path = `${cwd}/.otter/target/manifest.json`;
  const manifest = {
    generated_at: "2026-04-22T00:00:00.000Z",
    nodes: {
      customers: {
        id: "customers",
        path: "models/customers.sql",
        config: { materialized: "table" as const },
        sql: "select 1",
        compiled_sql: "select 1",
        deps: [],
        sources: [],
        seeds: [],
      },
    },
    order: ["customers"],
  };

  try {
    await writeManifest(path, manifest);
    await expect(Bun.file(path).text()).resolves.toContain('"customers"');
    await expect(readManifest(path)).resolves.toEqual(manifest);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
