import { expect, test } from "bun:test";
import { clickhouseSource } from "./index.ts";

const url = process.env.CLICKHOUSE_TEST_URL;
const skip = !url;

test("extract forwards URL credentials as basic auth", async () => {
  let auth: string | null = null;
  const queries: string[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      auth = req.headers.get("authorization");
      const body = await req.text();
      queries.push(body);
      if (body.startsWith("DESCRIBE")) {
        return new Response('{"name":"id","type":"UInt64"}\n');
      }
      return new Response('{"id":"1"}\n{"id":"2"}\n');
    },
  });

  try {
    const src = clickhouseSource({
      url: `http://otter:secret@127.0.0.1:${server.port}`,
    });
    const batches: Record<string, unknown>[][] = [];
    const noop = { get: () => undefined, set: () => {} };

    const { columnTypes, rows } = await src.extract("system.numbers", noop);
    for await (const batch of rows) batches.push(batch);

    expect(auth).not.toBeNull();
    expect(auth ?? "").toBe(`Basic ${Buffer.from("otter:secret").toString("base64")}`);
    expect(queries[0]).toBe("DESCRIBE TABLE `system`.`numbers` FORMAT JSONEachRow");
    expect(queries[1]).toBe("SELECT * FROM `system`.`numbers` FORMAT JSONEachRow");
    expect(columnTypes).toEqual({ id: "bigint" });
    expect(batches).toEqual([[{ id: "1" }, { id: "2" }]]);

    await src.close();
  } finally {
    await server.stop();
  }
});

test.skipIf(skip)("streams rows from a known clickhouse table", async () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by skip above
  const src = clickhouseSource({ url: url! });
  let total = 0;
  const noop = { get: () => undefined, set: () => {} };
  const { rows } = await src.extract("system.numbers", noop);
  for await (const batch of rows) {
    total += batch.length;
    if (total >= 10) break;
  }
  expect(total).toBeGreaterThan(0);
  await src.close();
});
