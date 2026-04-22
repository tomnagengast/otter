import { type ParseArgsConfig, parseArgs } from "node:util";

export interface Command<F extends ParseArgsConfig["options"] = ParseArgsConfig["options"]> {
  name: string;
  summary: string;
  flags: F;
  run: (args: { values: Record<string, unknown>; positionals: string[] }) => Promise<number>;
}

export function defineCommand<F extends ParseArgsConfig["options"]>(c: Command<F>): Command<F> {
  return c;
}

export async function route(argv: string[], commands: Record<string, Command>): Promise<number> {
  const [name, ...rest] = argv;
  if (!name || name === "--help" || name === "-h") {
    printRootHelp(commands);
    return 0;
  }
  if (name === "--version" || name === "-V") {
    console.log(await readVersion());
    return 0;
  }
  const cmd = commands[name];
  if (!cmd) {
    console.error(`unknown command: ${name}`);
    printRootHelp(commands);
    return 1;
  }
  const parsed = parseArgs({ args: rest, options: cmd.flags, allowPositionals: true });
  return cmd.run({ values: parsed.values, positionals: parsed.positionals });
}

function printRootHelp(commands: Record<string, Command>): void {
  console.log("usage: otter <command> [flags]\n\ncommands:");
  for (const c of Object.values(commands)) {
    console.log(`  ${c.name.padEnd(10)} ${c.summary}`);
  }
}

async function readVersion(): Promise<string> {
  const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
  return (pkg as { version?: string }).version ?? "0.0.0";
}
