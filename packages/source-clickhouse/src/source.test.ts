import { expect, test } from "bun:test";
import { createSource } from "./index.ts";

const url = process.env.CLICKHOUSE_TEST_URL;
const skip = !url;

test.skipIf(skip)("streams rows from a known clickhouse table", async () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skip above
  const src = createSource({ url: url! });
  let total = 0;
  const noop = { get: () => undefined, set: () => {} };
  for await (const batch of src.extract("system.numbers", noop)) {
    total += batch.length;
    if (total >= 10) break;
  }
  expect(total).toBeGreaterThan(0);
  await src.close();
});
