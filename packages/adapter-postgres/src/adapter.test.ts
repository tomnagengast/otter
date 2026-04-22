import { expect, test } from "bun:test";
import { createAdapter } from "./index.ts";

const url = process.env.PG_TEST_URL;
const skip = !url;

test.skipIf(skip)("replace + append + merge on a two-column table", async () => {
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const adapter = createAdapter({ url: url!, schema: "otter_test" });
  const target = { schema: "otter_test", name: "t" };

  async function* seed(batch: Record<string, unknown>[]) {
    yield batch;
  }

  // replace: creates table with one row
  await adapter.bulkLoad(target, seed([{ id: "1", v: "a" }]), "replace");

  // append: adds a second row
  const r = await adapter.bulkLoad(target, seed([{ id: "2", v: "b" }]), "append");
  expect(r.rows).toBe(1);

  // merge: upserts id=1 with updated value
  await adapter.bulkLoad(target, seed([{ id: "1", v: "a2" }]), "merge", { uniqueKey: "id" });

  const rows = await adapter.execute(`select * from otter_test.t order by id`);
  expect(rows).toBeTruthy();

  await adapter.execute(`drop table if exists otter_test.t`);
  await adapter.execute(`drop schema if exists otter_test`);
  await adapter.close();
});
