import { expect, test } from "bun:test";
import { compileTemplate } from "./template.ts";

test("extracts config block and strips it from compiled sql", () => {
  const out = compileTemplate(
    `{{ config(
      materialized: "table",
      unique_key: "id",
      tags: ["nightly"]
    ) }}

select 1 as id`,
    "m",
  );
  expect(out.config).toEqual({ materialized: "table", unique_key: "id", tags: ["nightly"] });
  expect(out.sql).not.toContain("{{");
  expect(out.sql.trim().startsWith("select 1")).toBe(true);
});

test("records ref and source dependencies and substitutes quoted identifiers", () => {
  const out = compileTemplate(
    `select * from {{ ref("a") }} join {{ source("pg", "users") }} on true`,
    "m",
  );
  expect([...out.deps]).toEqual(["a"]);
  expect([...out.sources]).toEqual(["pg.users"]);
  expect(out.sql).toContain(`"a"`);
  expect(out.sql).toContain(`"raw_pg_users"`);
});

test("records seed dependency", () => {
  const out = compileTemplate(`select * from {{ seed("countries") }}`, "m");
  expect([...out.seeds]).toEqual(["countries"]);
  expect(out.sql).toContain(`"seed_countries"`);
});

test("defaults to view when config is omitted", () => {
  const out = compileTemplate(`select 1`, "m");
  expect(out.config).toEqual({ materialized: "view" });
});

test("rejects multiple config blocks", () => {
  expect(() =>
    compileTemplate(
      `{{ config(materialized: "view") }} {{ config(materialized: "table") }} select 1`,
      "m",
    ),
  ).toThrow(/multiple/);
});

test("rejects invalid materialized value", () => {
  expect(() => compileTemplate(`{{ config(materialized: "snapshot") }} select 1`, "m")).toThrow(
    /invalid materialized/,
  );
});

test("rejects wrong-arity ref", () => {
  expect(() => compileTemplate(`select {{ ref("a", "b") }}`, "m")).toThrow(/expects 1/);
});

test("parses columns.tests from config", () => {
  const out = compileTemplate(
    `{{ config(
      materialized: "table",
      columns: {
        id: { tests: ["unique", "not_null"] },
        source: { tests: ["not_null"] },
      }
    ) }}
    select 1`,
    "m",
  );
  expect(out.config.columns).toEqual({
    id: { tests: ["unique", "not_null"] },
    source: { tests: ["not_null"] },
  });
});

test("rejects unknown test name", () => {
  expect(() =>
    compileTemplate(`{{ config(columns: { id: { tests: ["snapshot"] } }) }} select 1`, "m"),
  ).toThrow(/unknown test/);
});
