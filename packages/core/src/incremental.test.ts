import { expect, test } from "bun:test";
import { incrementalPredicate } from "./incremental.ts";

test("predicate references target max(cursor)", () => {
  const pred = incrementalPredicate({
    node: {
      id: "x",
      path: "",
      config: { materialized: "incremental" },
      sql: "",
      deps: [],
      sources: [],
      seeds: [],
    },
    target: { schema: "s", name: "x" },
    cursor: "created_at",
  });
  expect(pred).toBe(`created_at > (select coalesce(max(created_at), '1970-01-01') from "s"."x")`);
});
