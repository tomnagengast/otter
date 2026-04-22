import { expect, test } from "bun:test";
import { defineCommand, route } from "./argv.ts";

test("route dispatches subcommand with parsed flags + positionals", async () => {
  let seen: unknown = null;
  const commands = {
    load: defineCommand({
      name: "load",
      summary: "",
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
