import { expect, test } from "bun:test";
import type { Adapter } from "./adapter.ts";
import type { Manifest } from "./compile.ts";
import { runBuild } from "./runner.ts";

function mockAdapter(): { adapter: Adapter; calls: string[] } {
  const calls: string[] = [];
  const adapter: Adapter = {
    kind: "postgres",
    async introspect() {
      return { tables: [] };
    },
    async bulkLoad() {
      return { rows: 0, duration_ms: 0 };
    },
    async execute(sql) {
      calls.push(`execute:${sql.slice(0, 40)}`);
      return { duration_ms: 0 };
    },
    async swap(s, f) {
      calls.push(`swap:${s.name}->${f.name}`);
    },
    async close() {},
  };
  return { adapter, calls };
}

const manifest: Manifest = {
  generated_at: "",
  order: ["a", "b"],
  nodes: {
    a: {
      id: "a",
      path: "a.sql.ts",
      config: { materialized: "table" },
      sql: "select 1",
      deps: [],
      sources: [],
      compiled_sql: "select 1",
    },
    b: {
      id: "b",
      path: "b.sql.ts",
      config: { materialized: "view" },
      sql: "select 2",
      deps: ["a"],
      sources: [],
      compiled_sql: "select 2",
    },
  },
};

test("runBuild executes in topo order and swaps staging tables", async () => {
  const { adapter, calls } = mockAdapter();
  const events: string[] = [];
  const { results, emitter } = await runBuild({ manifest, adapter, schema: "s" });
  emitter.onNode((e) => events.push(`${e.type}:${e.id}`));
  expect(results.nodes.a?.status).toBe("success");
  expect(results.nodes.b?.status).toBe("success");
  expect(calls.some((c) => c.startsWith("swap:a__stg->a"))).toBe(true);
  expect(calls.some((c) => c.includes("create or replace view"))).toBe(true);
});
