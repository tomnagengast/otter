# @otter/cli

The `otter` CLI. Routes `argv` to subcommand handlers via a thin `parseArgs` wrapper with no
framework dependencies.

## Install

```bash
cd packages/cli && bun link
otter --help
```

## Commands

```
otter load <source>.<stream> [--profile dev] [--strategy append|merge|replace] [--unique-key col]
otter compile [--profile dev]
otter build [--profile dev] [-s selector]
otter list <models|sources|seeds>
otter show <model> [--profile dev] [--limit 10]
otter clean
```

## Adding a command

Create `src/commands/<name>.ts` using `defineCommand`, then register it in `src/index.ts`.

```ts
import { defineCommand } from "../argv.ts";

export const myCommand = defineCommand({
  name: "my-command",
  summary: "Does something useful",
  flags: { verbose: { type: "boolean" } },
  async run({ values }) {
    console.log("verbose:", values.verbose);
    return 0;
  },
});
```
