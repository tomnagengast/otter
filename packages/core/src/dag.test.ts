import { expect, test } from "bun:test";
import { buildDag, type DagNode, toposort } from "./dag.ts";

const n = (id: string, deps: string[] = []): DagNode => ({
  id,
  path: `${id}.sql.ts`,
  config: { materialized: "view" },
  sql: "select 1",
  deps,
  sources: [],
  seeds: [],
});

test("topo-sorts a linear chain", () => {
  const dag = buildDag([n("c", ["b"]), n("a"), n("b", ["a"])]);
  expect(toposort(dag)).toEqual(["a", "b", "c"]);
});

test("rejects a cycle", () => {
  const dag = buildDag([n("a", ["b"]), n("b", ["a"])]);
  expect(() => toposort(dag)).toThrow(/cycle/);
});

test("rejects unknown ref", () => {
  expect(() => buildDag([n("a", ["missing"])])).toThrow(/unknown model/);
});
