import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Manifest } from "./compile.ts";

export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await Bun.write(path, JSON.stringify(manifest, null, 2));
}

export async function readManifest(path: string): Promise<Manifest> {
  return Bun.file(path).json() as Promise<Manifest>;
}
