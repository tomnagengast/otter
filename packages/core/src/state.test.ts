import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { openState } from "./state.ts";

test("cursor round-trip", () => {
  const dir = mkdtempSync(`${tmpdir()}/otter-state-`);
  const store = openState(`${dir}/state.db`);
  expect(store.getCursor("s", "t")).toBeUndefined();
  store.setCursor("s", "t", "2024-01-01");
  expect(store.getCursor("s", "t")).toBe("2024-01-01");
  store.setCursor("s", "t", "2024-02-01");
  expect(store.getCursor("s", "t")).toBe("2024-02-01");
  store.clearCursor("s", "t");
  expect(store.getCursor("s", "t")).toBeUndefined();
  store.close();
});
