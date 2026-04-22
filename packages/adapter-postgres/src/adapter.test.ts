import { expect, test } from "bun:test";
import { SQL } from "bun";
import { postgresAdapter } from "./index.ts";

const url = process.env.PG_TEST_URL;
const skip = !url;

function testSchema(name: string): string {
  return `otter_${name}_${crypto.randomUUID().replaceAll("-", "")}`;
}

test.skipIf(skip)("replace + append + merge on a two-column table", async () => {
  const schema = testSchema("replace");
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const adapter = postgresAdapter({ url: url!, schema });
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const sql = new SQL(url!);
  const target = { schema, name: "t" };

  async function* seed(batch: Record<string, unknown>[]) {
    yield batch;
  }

  try {
    await adapter.execute(`drop schema if exists "${schema}" cascade`);

    // replace: creates table with one row
    await adapter.bulkLoad(target, seed([{ id: "1", v: "a" }]), "replace");

    // append: adds a second row
    const r = await adapter.bulkLoad(target, seed([{ id: "2", v: "b" }]), "append");
    expect(r.rows).toBe(1);

    // merge: upserts id=1 with updated value
    await adapter.bulkLoad(target, seed([{ id: "1", v: "a2" }]), "merge", { uniqueKey: "id" });

    const rows = (await sql.unsafe(`select id, v from "${schema}"."t" order by id`)) as {
      id: string;
      v: string;
    }[];
    expect(rows).toEqual([
      { id: "1", v: "a2" },
      { id: "2", v: "b" },
    ]);
  } finally {
    await adapter.execute(`drop schema if exists "${schema}" cascade`).catch(() => {});
    await sql.end();
    await adapter.close();
  }
});

test.skipIf(skip)("mergeIncremental upserts without a pre-existing unique constraint", async () => {
  const schema = testSchema("incremental");
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const adapter = postgresAdapter({ url: url!, schema });
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const sql = new SQL(url!);

  try {
    await adapter.execute(`drop schema if exists "${schema}" cascade`);
    await adapter.execute(`create schema if not exists "${schema}"`);

    await adapter.mergeIncremental?.({
      staging: { schema, name: "t__stg_1" },
      final: { schema, name: "t_incremental" },
      compiledSql: `select '1'::text as id, 'a'::text as v`,
      uniqueKey: "id",
    });

    await adapter.mergeIncremental?.({
      staging: { schema, name: "t__stg_2" },
      final: { schema, name: "t_incremental" },
      compiledSql: `select '1'::text as id, 'a2'::text as v union all select '2'::text as id, 'b'::text as v`,
      uniqueKey: "id",
    });

    const rows = (await sql.unsafe(
      `select id, v from "${schema}"."t_incremental" order by id`,
    )) as {
      id: string;
      v: string;
    }[];
    expect(rows).toEqual([
      { id: "1", v: "a2" },
      { id: "2", v: "b" },
    ]);
  } finally {
    await adapter.execute(`drop schema if exists "${schema}" cascade`).catch(() => {});
    await sql.end();
    await adapter.close();
  }
});

test.skipIf(skip)("swap can replace an existing table repeatedly", async () => {
  const schema = testSchema("swap");
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const adapter = postgresAdapter({ url: url!, schema });
  // biome-ignore lint/style/noNonNullAssertion: test is skipped when url is undefined
  const sql = new SQL(url!);

  try {
    await adapter.execute(`drop schema if exists "${schema}" cascade`);
    await adapter.execute(`create schema if not exists "${schema}"`);

    await adapter.execute(`create table "${schema}"."t__stg" as select '1'::text as id`);
    await adapter.swap({ schema, name: "t__stg" }, { schema, name: "t" });

    await adapter.execute(`create table "${schema}"."t__stg" as select '2'::text as id`);
    await adapter.swap({ schema, name: "t__stg" }, { schema, name: "t" });

    const rows = (await sql.unsafe(`select id from "${schema}"."t"`)) as { id: string }[];
    expect(rows).toEqual([{ id: "2" }]);

    const tables = (await sql`
      select table_name
      from information_schema.tables
      where table_schema = ${schema}
      order by table_name
    `) as { table_name: string }[];
    expect(tables).toEqual([{ table_name: "t" }]);
  } finally {
    await adapter.execute(`drop schema if exists "${schema}" cascade`).catch(() => {});
    await sql.end();
    await adapter.close();
  }
});
