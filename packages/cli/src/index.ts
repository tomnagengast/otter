import { route } from "./argv.ts";
import { buildCommand } from "./commands/build.ts";
import { cleanCommand } from "./commands/clean.ts";
import { compileCommand } from "./commands/compile.ts";
import { listCommand } from "./commands/list.ts";
import { loadCommand } from "./commands/load.ts";
import { showCommand } from "./commands/show.ts";

const COMMANDS = {
  load: loadCommand,
  compile: compileCommand,
  build: buildCommand,
  list: listCommand,
  show: showCommand,
  clean: cleanCommand,
} as const;

export async function main(argv: string[]): Promise<number> {
  try {
    return await route(argv, COMMANDS);
  } catch (error) {
    console.error(formatCliError(error));
    return 1;
  }
}

function formatCliError(error: unknown): string {
  return `error: ${error instanceof Error ? error.message : String(error)}`;
}
