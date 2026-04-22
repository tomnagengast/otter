import { expect, test } from "bun:test";
import { createSource } from "./index.ts";

const url = process.env.PG_SOURCE_TEST_URL;
const skip = !url;

test.skipIf(skip)("extracts rows from a postgres table in batches", async () => {
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const source = createSource({ url: url! });
  // information_schema.schemata always exists in Postgres
  const batches: Record<string, unknown>[][] = [];
  for await (const batch of source.extract("information_schema.schemata", {
    get: () => undefined,
    set: () => {},
  })) {
    batches.push(batch);
  }
  expect(batches.length).toBeGreaterThan(0);
  expect(batches[0]?.length).toBeGreaterThan(0);
  await source.close();
});
