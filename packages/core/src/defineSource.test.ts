import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineSource, loadSourceDefinitions, resolveStream } from "./defineSource.ts";

test("defineSource is an identity helper", () => {
  const def = defineSource({
    streams: {
      customers: {
        write_disposition: "merge",
        primary_key: "id",
        incremental: { cursor_field: "updated_at" },
      },
    },
  });
  expect(def.streams.customers?.write_disposition).toBe("merge");
  expect(def.streams.customers?.primary_key).toBe("id");
});

test("loadSourceDefinitions reads *.ts files and keys them by filename", async () => {
  const dir = mkdtempSync(join(tmpdir(), "otter-sources-"));
  try {
    mkdirSync(`${dir}/sources`);
    writeFileSync(
      `${dir}/sources/postgres.ts`,
      `export default {
  streams: {
    customers: { write_disposition: "merge", primary_key: "id" },
    orders: { write_disposition: "append" },
  },
};
`,
    );
    const defs = await loadSourceDefinitions(dir, "sources");
    expect(Object.keys(defs)).toEqual(["postgres"]);
    expect(defs.postgres?.streams.customers?.write_disposition).toBe("merge");
    expect(resolveStream(defs, "postgres", "orders")?.write_disposition).toBe("append");
    expect(resolveStream(defs, "postgres", "missing")).toBeUndefined();
    expect(resolveStream(defs, "other", "customers")).toBeUndefined();
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("loadSourceDefinitions returns empty map when directory is absent", async () => {
  const dir = mkdtempSync(join(tmpdir(), "otter-sources-"));
  try {
    const defs = await loadSourceDefinitions(dir, "sources");
    expect(defs).toEqual({});
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test("loadSourceDefinitions errors when default export is missing", async () => {
  const dir = mkdtempSync(join(tmpdir(), "otter-sources-"));
  try {
    mkdirSync(`${dir}/sources`);
    writeFileSync(`${dir}/sources/bad.ts`, `export const foo = 1;\n`);
    await expect(loadSourceDefinitions(dir, "sources")).rejects.toThrow(/missing default export/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
