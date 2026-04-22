import type { CursorState, Row, Source } from "@otter/core";
import { SQL } from "bun";

const BATCH = 5000;

export function createSource(config: { url: string }): Source {
  const sql = new SQL(config.url);
  return {
    kind: "postgres",
    async *extract(stream: string, _state: CursorState): AsyncGenerator<Row[]> {
      const parts = stream.includes(".") ? stream.split(".") : ["public", stream];
      const schema = parts[0] ?? "public";
      const table = parts[1] ?? stream;
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
