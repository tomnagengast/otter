import { expect, test } from "bun:test";
import { createSource } from "./index.ts";

const url = process.env.CLICKHOUSE_TEST_URL;
const skip = !url;

test("extract forwards URL credentials as basic auth", async () => {
  let auth: string | null = null;
  let query = "";
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      auth = req.headers.get("authorization");
      query = await req.text();
      return new Response('{"id":"1"}\n{"id":"2"}\n');
    },
  });

  try {
    const src = createSource({ url: `http://otter:secret@127.0.0.1:${server.port}` });
    const batches: Record<string, unknown>[][] = [];
    const noop = { get: () => undefined, set: () => {} };

    for await (const batch of src.extract("system.numbers", noop)) {
      batches.push(batch);
    }

    expect(auth).not.toBeNull();
    expect(auth ?? "").toBe(`Basic ${Buffer.from("otter:secret").toString("base64")}`);
    expect(query).toBe("SELECT * FROM `system`.`numbers` FORMAT JSONEachRow");
    expect(batches).toEqual([[{ id: "1" }, { id: "2" }]]);

    await src.close();
  } finally {
    await server.stop();
  }
});

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
