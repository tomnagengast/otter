import { mkdir, rm } from "node:fs/promises";
import { dirname } from "node:path";
import type { Manifest } from "./compile.ts";

export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, JSON.stringify(manifest));
}

export async function readManifest(path: string): Promise<Manifest> {
  return Bun.file(path).json() as Promise<Manifest>;
}

export async function writeCompiledSql(manifest: Manifest, cwd: string): Promise<void> {
  const compiledDir = `${cwd}/.otter/compiled`;
  await rm(compiledDir, { recursive: true, force: true });
  for (const node of Object.values(manifest.nodes)) {
    const out = `${compiledDir}/${node.path}`;
    await mkdir(dirname(out), { recursive: true });
    await Bun.write(out, node.compiled_sql);
  }
}
