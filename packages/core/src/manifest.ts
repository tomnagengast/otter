import type { Manifest } from "./compile.ts";

export async function writeManifest(path: string, manifest: Manifest): Promise<void> {
  const file = Bun.file(path);
  await Bun.write(file, JSON.stringify(manifest, null, 2));
}

export async function readManifest(path: string): Promise<Manifest> {
  return Bun.file(path).json() as Promise<Manifest>;
}
