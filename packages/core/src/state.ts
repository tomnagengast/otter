import { Database } from "bun:sqlite";

export interface StateStore {
  getCursor(sourceName: string, stream: string): string | undefined;
  setCursor(sourceName: string, stream: string, value: string): void;
  clearCursor(sourceName: string, stream: string): void;
  close(): void;
}

export function openState(path: string): StateStore {
  const db = new Database(path, { create: true });
  db.exec(`
    create table if not exists cursors (
      source_name text not null,
      stream text not null,
      value text not null,
      updated_at integer not null,
      primary key (source_name, stream)
    )
  `);
  return {
    getCursor(s, t) {
      const row = db
        .query<{ value: string }, [string, string]>(
          `select value from cursors where source_name = ? and stream = ?`,
        )
        .get(s, t);
      return row?.value;
    },
    setCursor(s, t, v) {
      db.run(
        `insert into cursors (source_name, stream, value, updated_at)
         values (?, ?, ?, ?)
         on conflict (source_name, stream) do update set value = excluded.value, updated_at = excluded.updated_at`,
        [s, t, v, Date.now()],
      );
    },
    clearCursor(s, t) {
      db.run(`delete from cursors where source_name = ? and stream = ?`, [s, t]);
    },
    close() {
      db.close();
    },
  };
}
