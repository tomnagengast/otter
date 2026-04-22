import type { CursorState, ExtractOpts, ExtractStream, Row, Source } from "@otter/core";
import { SQL } from "bun";

const BATCH = 5000;

export interface PostgresSourceOptions {
  /** Postgres connection string. */
  url: string;
}

export function postgresSource(options: PostgresSourceOptions): Source {
  if (!options.url) throw new Error("source-postgres: options.url is required");
  const sql = new SQL(options.url);
  return {
    kind: "postgres",
    async extract(stream: string, state: CursorState, opts?: ExtractOpts): Promise<ExtractStream> {
      const identifier = opts?.identifier ?? stream;
      const [schemaPart, tablePart] = identifier.includes(".")
        ? identifier.split(".")
        : [undefined, identifier];
      const schema = opts?.schema ?? schemaPart ?? "public";
      const table = tablePart ?? identifier;

      const colRows = (await sql`
        select column_name, data_type, udt_name
        from information_schema.columns
        where table_schema = ${schema} and table_name = ${table}
        order by ordinal_position
      `) as { column_name: string; data_type: string; udt_name: string }[];
      const columnTypes: Record<string, string> = {};
      for (const r of colRows) columnTypes[r.column_name] = mapPgType(r.data_type, r.udt_name);

      const cursorField = opts?.cursorField;

      async function* rows(): AsyncGenerator<Row[]> {
        if (cursorField) {
          const key = `${stream}:${cursorField}`;
          let cursor = state.get(key) ?? opts?.initialValue;
          while (true) {
            const batch = (
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
            if (batch.length === 0) break;
            yield batch;
            const last = batch[batch.length - 1]?.[cursorField];
            if (last === undefined || last === null) break;
            cursor = serializeCursor(last);
            state.set(key, cursor);
            if (batch.length < BATCH) break;
          }
          return;
        }

        let offset = 0;
        while (true) {
          const batch = (await sql`
            select * from ${sql(schema)}.${sql(table)}
            order by 1
            limit ${BATCH} offset ${offset}
          `) as Row[];
          if (batch.length === 0) break;
          yield batch;
          if (batch.length < BATCH) break;
          offset += batch.length;
        }
      }

      return { columnTypes, rows: rows() };
    },
    async close() {
      await sql.end();
    },
  };
}

function serializeCursor(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function mapPgType(dataType: string, udtName: string): string {
  const t = dataType.toLowerCase();
  switch (t) {
    case "smallint":
    case "integer":
    case "bigint":
    case "numeric":
    case "real":
    case "double precision":
    case "boolean":
    case "date":
    case "text":
    case "uuid":
    case "json":
    case "jsonb":
      return t;
    case "timestamp without time zone":
      return "timestamp";
    case "timestamp with time zone":
      return "timestamptz";
    case "character varying":
    case "character":
      return "text";
    case "user-defined":
      return udtName === "citext" ? "text" : "text";
    default:
      return "text";
  }
}
