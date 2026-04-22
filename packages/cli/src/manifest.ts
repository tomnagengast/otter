import { readManifest } from "@otter/core";

const compiledManifestPath = ".otter/target/manifest.json";

type ManifestHint = "build" | "list" | "show";

export async function readCompiledManifest(
  cwd: string,
  hint: ManifestHint = "build",
): Promise<Awaited<ReturnType<typeof readManifest>>> {
  try {
    return await readManifest(`${cwd}/${compiledManifestPath}`);
  } catch (error) {
    if (isMissingFileError(error)) {
      throw new Error(
        hint === "show"
          ? `compiled manifest not found at ${compiledManifestPath}; run \`otter compile\` first, then \`otter build\` before \`otter show\``
          : `compiled manifest not found at ${compiledManifestPath}; run \`otter compile\` first`,
      );
    }
    if (error instanceof SyntaxError) {
      throw new Error(
        `compiled manifest at ${compiledManifestPath} is unreadable; rerun \`otter compile\``,
      );
    }
    throw error;
  }
}

function isMissingFileError(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";
}
