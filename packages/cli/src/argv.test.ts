import { expect, test } from "bun:test";
import { defineCommand, route } from "./argv.ts";

async function captureLogs(fn: () => Promise<number>): Promise<{ code: number; logs: string[] }> {
  const logs: string[] = [];
  const original = console.log;
  console.log = (...args: unknown[]) => {
    logs.push(args.join(" "));
  };
  try {
    const code = await fn();
    return { code, logs };
  } finally {
    console.log = original;
  }
}

test("route dispatches subcommand with parsed flags + positionals", async () => {
  let seen: unknown = null;
  const commands = {
    load: defineCommand({
      name: "load",
      summary: "",
      usage: "[flags] <source>.<stream>",
      flags: { target: { type: "string" } },
      async run(args) {
        seen = args;
        return 0;
      },
    }),
  };
  const code = await route(["load", "stripe_pg.charges", "--target", "dev"], commands);
  expect(code).toBe(0);
  expect(seen).toEqual({
    values: { target: "dev" },
    positionals: ["stripe_pg.charges"],
  });
});

test("route returns 1 on unknown command", async () => {
  const code = await route(["nope"], {});
  expect(code).toBe(1);
});

test("route prints subcommand help for --help without running the command", async () => {
  let ran = false;
  const commands = {
    load: defineCommand({
      name: "load",
      summary: "Extract from sources into the target",
      usage: "[flags] <source>.<stream>",
      flags: { target: { type: "string" } },
      async run() {
        ran = true;
        return 0;
      },
    }),
  };

  const { code, logs } = await captureLogs(() => route(["load", "--help"], commands));

  expect(code).toBe(0);
  expect(ran).toBe(false);
  expect(logs.join("\n")).toContain("usage: otter load [flags] <source>.<stream>");
  expect(logs.join("\n")).toContain("Extract from sources into the target");
  expect(logs.join("\n")).toContain("-h, --help");
  expect(logs.join("\n")).toContain("--target <value>");
});

test("route prints subcommand help for -h", async () => {
  const commands = {
    load: defineCommand({
      name: "load",
      summary: "Extract from sources into the target",
      usage: "[flags] <source>.<stream>",
      flags: {},
      async run() {
        return 0;
      },
    }),
  };

  const { code, logs } = await captureLogs(() => route(["load", "-h"], commands));

  expect(code).toBe(0);
  expect(logs.join("\n")).toContain("usage: otter load [flags] <source>.<stream>");
});
