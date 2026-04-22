import { expect, test } from "bun:test";
import { buildDag, type DagNode } from "../dag.ts";
import { evaluate } from "./evaluate.ts";
import { parseSelector } from "./parse.ts";

const n = (id: string, deps: string[] = [], tags: string[] = []): DagNode => ({
  id,
  path: `${id}.sql.ts`,
  config: { materialized: "view", tags },
  sql: "",
  deps,
  sources: [],
});

const dag = buildDag([n("a"), n("b", ["a"]), n("c", ["b"], ["nightly"])]);

test("tag method selects tagged node", () => {
  expect([...evaluate(parseSelector("tag:nightly"), dag)]).toEqual(["c"]);
});

test("+model selects ancestors", () => {
  expect([...evaluate(parseSelector("+c"), dag)].sort()).toEqual(["a", "b", "c"]);
});

test("model+ selects descendants", () => {
  expect([...evaluate(parseSelector("a+"), dag)].sort()).toEqual(["a", "b", "c"]);
});

test("space is union", () => {
  expect([...evaluate(parseSelector("a b"), dag)].sort()).toEqual(["a", "b"]);
});

test("comma is intersection", () => {
  expect([...evaluate(parseSelector("+c,tag:nightly"), dag)]).toEqual(["c"]);
});
