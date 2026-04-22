import type { Adapter, LoadStrategy, MergeIncrementalOpts, Row, TableRef } from "@otter/core";
import { NotSupportedError } from "@otter/core";
import { SQL } from "bun";
import { qualify, quote } from "./identifiers.ts";

export { NotSupportedError };

export function createAdapter(config: { url: string; schema?: string }): Adapter {
  const sql = new SQL(config.url);
  const defaultSchema = config.schema ?? "public";

  function inferColumns(rows: Row[]): string[] {
    return rows[0] ? Object.keys(rows[0]) : [];
  }

  async function ensureTable(t: TableRef, cols: string[]): Promise<void> {
    const colDefs = cols.map((c) => `${quote(c)} text`).join(", ");
    await sql.unsafe(`create schema if not exists ${quote(t.schema)}`);
    await sql.unsafe(`create table if not exists ${qualify(t)} (${colDefs})`);
  }

  /** Escape a value for inline SQL literal (all columns are text). */
  function escapeLiteral(v: unknown): string {
    if (v === null || v === undefined) return "NULL";
    return `'${String(v).replace(/'/g, "''")}'`;
  }

  async function insertBatch(
    t: TableRef,
    batch: Row[],
    strategy: LoadStrategy,
    uniqueKey?: string,
  ): Promise<number> {
    if (batch.length === 0) return 0;
    const firstRow = batch[0];
    if (!firstRow) return 0;
    const cols = Object.keys(firstRow);
    const colList = cols.map(quote).join(", ");
    const valueClauses = batch
      .map((row) => `(${cols.map((c) => escapeLiteral(row[c])).join(", ")})`)
      .join(", ");
    const insertSql = `insert into ${qualify(t)} (${colList}) values ${valueClauses}`;
    if (strategy === "merge") {
      if (!uniqueKey) throw new Error("merge requires unique_key");
      const updateCols = cols.filter((c) => c !== uniqueKey);
      const setClauses = updateCols.map((c) => `${quote(c)} = excluded.${quote(c)}`).join(", ");
      await sql.unsafe(
        `${insertSql} on conflict (${quote(uniqueKey)}) do update set ${setClauses}`,
      );
    } else {
      await sql.unsafe(insertSql);
    }
    return batch.length;
  }

  return {
    kind: "postgres",
    async introspect() {
      const rows = (await sql`
        select table_schema as schema, table_name as name
        from information_schema.tables where table_type = 'BASE TABLE'
      `) as { schema: string; name: string }[];
      return { tables: rows };
    },
    async bulkLoad(target, rows, strategy, opts) {
      const t: TableRef = { schema: target.schema || defaultSchema, name: target.name };
      const started = performance.now();
      let total = 0;
      let firstBatch = true;
      if (strategy === "replace") {
        await sql.unsafe(`drop table if exists ${qualify(t)}`);
      }
      for await (const batch of rows) {
        if (firstBatch) {
          await ensureTable(t, inferColumns(batch));
          firstBatch = false;
        }
        total += await insertBatch(t, batch, strategy, opts?.uniqueKey);
      }
      return { rows: total, duration_ms: performance.now() - started };
    },
    async execute(query) {
      const started = performance.now();
      await sql.unsafe(query);
      return { duration_ms: performance.now() - started };
    },
    async swap(staging, final) {
      await sql.begin(async (tx) => {
        await tx.unsafe(`drop table if exists ${qualify(final)}`);
        await tx.unsafe(`alter table ${qualify(staging)} rename to ${quote(final.name)}`);
      });
    },
    async mergeIncremental(opts: MergeIncrementalOpts) {
      const { staging, final, compiledSql, uniqueKey } = opts;
      // Build staging table.
      await sql.unsafe(`create table ${qualify(staging)} as ${compiledSql}`);
      // Discover columns from information_schema.
      const colRows = (await sql`
        select column_name
        from information_schema.columns
        where table_schema = ${staging.schema} and table_name = ${staging.name}
        order by ordinal_position
      `) as { column_name: string }[];
      const cols = colRows.map((r) => r.column_name);
      if (cols.length === 0) {
        await sql.unsafe(`drop table ${qualify(staging)}`);
        return;
      }
      const colList = cols.map(quote).join(", ");
      const updates = cols
        .filter((c) => c !== uniqueKey)
        .map((c) => `${quote(c)} = excluded.${quote(c)}`)
        .join(", ");
      // Ensure the final table exists before we try to merge into it.
      await sql.unsafe(
        `create table if not exists ${qualify(final)} as select * from ${qualify(staging)} where false`,
      );
      await sql.unsafe(`
        insert into ${qualify(final)} (${colList})
        select ${colList} from ${qualify(staging)}
        on conflict (${quote(uniqueKey)}) do update set ${updates}
      `);
      await sql.unsafe(`drop table ${qualify(staging)}`);
    },
    async close() {
      await sql.end();
    },
  };
}
