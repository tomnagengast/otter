import { expect, test } from "bun:test";
import type { Adapter, ExecuteResult } from "./adapter.ts";
import type { Manifest } from "./compile.ts";
import { runModelTests } from "./tests.ts";

function mockAdapter(responses: Record<string, number>): { adapter: Adapter; queries: string[] } {
  const queries: string[] = [];
  const adapter: Adapter = {
    kind: "postgres",
    async introspect() {
      return { tables: [] };
    },
    async bulkLoad() {
      return { rows: 0, duration_ms: 0 };
    },
    async execute(sql: string): Promise<ExecuteResult> {
      queries.push(sql);
      const match = Object.entries(responses).find(([needle]) => sql.includes(needle));
      return { rows: [{ n: match ? match[1] : 0 }], duration_ms: 0 };
    },
    async swap() {},
    async close() {},
  };
  return { adapter, queries };
}

const manifest: Manifest = {
  generated_at: "",
  order: ["customers"],
  nodes: {
    customers: {
      id: "customers",
      path: "customers.sql",
      config: {
        materialized: "table",
        columns: {
          id: { tests: ["unique", "not_null"] },
          email: { tests: ["not_null"] },
        },
      },
      sql: "",
      deps: [],
      sources: [],
      seeds: [],
      compiled_sql: "",
    },
  },
};

test("runModelTests returns pass for zero-failure queries", async () => {
  const { adapter, queries } = mockAdapter({});
  const { tests } = await runModelTests({ manifest, adapter, schema: "analytics" });
  expect(tests).toHaveLength(3);
  expect(tests.every((t) => t.status === "pass")).toBe(true);
  expect(queries.some((q) => q.includes(`where "id" is null`))).toBe(true);
  expect(queries.some((q) => q.includes(`group by "id"`))).toBe(true);
});

test("runModelTests reports fail when failures > 0", async () => {
  const { adapter } = mockAdapter({ 'where "id" is null': 3 });
  const { tests } = await runModelTests({ manifest, adapter, schema: "analytics" });
  const notNull = tests.find((t) => t.column === "id" && t.test === "not_null");
  expect(notNull?.status).toBe("fail");
  expect(notNull?.failures).toBe(3);
});

test("runModelTests skips models without columns config", async () => {
  const empty: Manifest = {
    generated_at: "",
    order: ["a"],
    nodes: {
      a: {
        id: "a",
        path: "a.sql",
        config: { materialized: "view" },
        sql: "",
        deps: [],
        sources: [],
        seeds: [],
        compiled_sql: "",
      },
    },
  };
  const { adapter } = mockAdapter({});
  const { tests } = await runModelTests({ adapter, manifest: empty, schema: "s" });
  expect(tests).toHaveLength(0);
});
