import type { CursorState, ExtractOpts, Row, Source } from "@otter/core";
import { SQL } from "bun";

const BATCH = 5000;

export function createSource(config: { url: string }): Source {
  const sql = new SQL(config.url);
  return {
    kind: "postgres",
    async *extract(stream: string, state: CursorState, opts?: ExtractOpts): AsyncGenerator<Row[]> {
      const identifier = opts?.identifier ?? stream;
      const [schemaPart, tablePart] = identifier.includes(".")
        ? identifier.split(".")
        : [undefined, identifier];
      const schema = opts?.schema ?? schemaPart ?? "public";
      const table = tablePart ?? identifier;

      const cursorField = opts?.cursorField;

      if (cursorField) {
        const key = `${stream}:${cursorField}`;
        let cursor = state.get(key) ?? opts?.initialValue;
        while (true) {
          const rows = (
            cursor !== undefined
              ? await sql`
                select * from ${sql(schema)}.${sql(table)}
                where ${sql(cursorField)} > ${cursor}
                order by ${sql(cursorField)} asc
                limit ${BATCH}
              `
              : await sql`
                select * from ${sql(schema)}.${sql(table)}
                order by ${sql(cursorField)} asc
                limit ${BATCH}
              `
          ) as Row[];
          if (rows.length === 0) break;
          yield rows;
          const last = rows[rows.length - 1]?.[cursorField];
          if (last === undefined || last === null) break;
          cursor = String(last);
          state.set(key, cursor);
          if (rows.length < BATCH) break;
        }
        return;
      }

      let offset = 0;
      while (true) {
        const rows = (await sql`
          select * from ${sql(schema)}.${sql(table)}
          order by 1
          limit ${BATCH} offset ${offset}
        `) as Row[];
        if (rows.length === 0) break;
        yield rows;
        if (rows.length < BATCH) break;
        offset += rows.length;
      }
    },
    async close() {
      await sql.end();
    },
  };
}
