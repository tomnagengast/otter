import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readCompiledManifest } from "./manifest.ts";

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "otter-cli-manifest-"));
}

test("readCompiledManifest explains how to recover when show runs before compile", async () => {
  const cwd = tempDir();

  try {
    await expect(readCompiledManifest(cwd, "show")).rejects.toThrow(
      "compiled manifest not found at .otter/target/manifest.json; run `otter compile` first, then `otter build` before `otter show`",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("readCompiledManifest explains how to recover when the manifest is invalid", async () => {
  const cwd = tempDir();
  const path = `${cwd}/.otter/target/manifest.json`;
  mkdirSync(`${cwd}/.otter/target`, { recursive: true });

  try {
    await Bun.write(path, "");
    await expect(readCompiledManifest(cwd)).rejects.toThrow(
      "compiled manifest at .otter/target/manifest.json is unreadable; rerun `otter compile`",
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("readCompiledManifest returns the parsed manifest when present", async () => {
  const cwd = tempDir();
  const path = `${cwd}/.otter/target/manifest.json`;
  const manifest = {
    generated_at: "2026-04-22T00:00:00.000Z",
    nodes: {
      customers: {
        id: "customers",
        path: "models/customers.sql.ts",
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
  mkdirSync(`${cwd}/.otter/target`, { recursive: true });

  try {
    await Bun.write(path, JSON.stringify(manifest));
    await expect(readCompiledManifest(cwd)).resolves.toEqual(manifest);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
