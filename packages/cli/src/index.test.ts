import { expect, test } from "bun:test";
import { main } from "./index.ts";

test("main reports command errors without a Bun stack trace", async () => {
  const errors: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => {
    errors.push(args.join(" "));
  };

  try {
    const code = await main(["show"]);
    expect(code).toBe(1);
    expect(errors).toEqual(["error: usage: otter show <model>"]);
  } finally {
    console.error = original;
  }
});
