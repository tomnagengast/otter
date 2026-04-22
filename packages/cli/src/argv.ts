import { type ParseArgsConfig, parseArgs } from "node:util";

type CommandFlags = NonNullable<ParseArgsConfig["options"]>;

export interface Command<F extends CommandFlags = CommandFlags> {
  name: string;
  summary: string;
  usage?: string;
  flags: F;
  run: (args: { values: Record<string, unknown>; positionals: string[] }) => Promise<number>;
}

export function defineCommand<F extends CommandFlags>(c: Command<F>): Command<F> {
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
  const parsed = parseArgs({ args: rest, options: commandFlags(cmd), allowPositionals: true });
  const values = parsed.values as Record<string, unknown>;
  if (values.help === true) {
    printCommandHelp(cmd);
    return 0;
  }
  return cmd.run({ values, positionals: parsed.positionals });
}

function printRootHelp(commands: Record<string, Command>): void {
  console.log("usage: otter <command> [flags]\n\ncommands:");
  for (const c of Object.values(commands)) {
    console.log(`  ${c.name.padEnd(10)} ${c.summary}`);
  }
  console.log("\nuse 'otter <command> --help' for command-specific usage");
}

function printCommandHelp(cmd: Command): void {
  const usage = cmd.usage ? ` ${cmd.usage}` : "";
  console.log(`usage: otter ${cmd.name}${usage}\n`);
  console.log(cmd.summary);
  const flags = formatFlags(cmd);
  if (flags.length === 0) return;
  console.log("\nflags:");
  for (const flag of flags) {
    console.log(`  ${flag}`);
  }
}

function commandFlags(cmd: Command): CommandFlags {
  return {
    help: { type: "boolean", short: "h" },
    ...cmd.flags,
  };
}

function formatFlags(cmd: Command): string[] {
  const flags = commandFlags(cmd);
  return (Object.entries(flags) as [string, CommandFlags[string]][]).map(([name, config]) => {
    const parts = [`--${name}`];
    if (config.short) parts.unshift(`-${config.short}`);
    let line = parts.join(", ");
    if (config.type === "string") line += " <value>";
    if (config.default !== undefined) line += ` (default: ${String(config.default)})`;
    return line;
  });
}

async function readVersion(): Promise<string> {
  const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json();
  return (pkg as { version?: string }).version ?? "0.0.0";
}
