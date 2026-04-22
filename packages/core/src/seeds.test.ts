import { expect, test } from "bun:test";
import { inferColumnType, parseCsv } from "./seeds.ts";

test("inferColumnType returns bigint for integers", () => {
  expect(inferColumnType(["1", "2", "-3"])).toBe("bigint");
});

test("inferColumnType widens bigint + decimal to numeric", () => {
  expect(inferColumnType(["1", "2.5", "3"])).toBe("numeric");
});

test("inferColumnType returns numeric for out-of-range integers", () => {
  expect(inferColumnType(["99999999999999999999"])).toBe("numeric");
});

test("inferColumnType returns boolean for true/false", () => {
  expect(inferColumnType(["true", "False", "TRUE"])).toBe("boolean");
});

test("inferColumnType returns date for YYYY-MM-DD", () => {
  expect(inferColumnType(["2024-01-01", "2024-12-31"])).toBe("date");
});

test("inferColumnType returns timestamptz for ISO timestamps", () => {
  expect(inferColumnType(["2024-01-01T12:00:00Z", "2024-06-01 00:00:00"])).toBe("timestamptz");
});

test("inferColumnType widens date + timestamp to timestamptz", () => {
  expect(inferColumnType(["2024-01-01", "2024-01-02T00:00:00Z"])).toBe("timestamptz");
});

test("inferColumnType falls back to text on mixed types", () => {
  expect(inferColumnType(["1", "abc"])).toBe("text");
  expect(inferColumnType(["true", "1"])).toBe("text");
});

test("inferColumnType returns text for empty input", () => {
  expect(inferColumnType([])).toBe("text");
});

test("parseCsv infers column types and nulls empties", () => {
  const csv = "id,amount,note\n1,10.50,hello\n2,20,\n";
  const { columns, rows, columnTypes } = parseCsv(csv);
  expect(columns).toEqual(["id", "amount", "note"]);
  expect(columnTypes).toEqual({ id: "bigint", amount: "numeric", note: "text" });
  expect(rows).toEqual([
    { id: "1", amount: "10.50", note: "hello" },
    { id: "2", amount: "20", note: null },
  ]);
});
