import type { Row, Source } from "@otter/core";

export function createSource(config: { url: string }): Source {
  return {
    kind: "clickhouse",
    async *extract(stream, state, opts) {
      const identifier = opts?.identifier ?? stream;
      const table = opts?.schema ? `${opts.schema}.${identifier}` : identifier;
      const cursorField = opts?.cursorField;
      const key = cursorField ? `${stream}:${cursorField}` : "";
      const cursor = cursorField ? (state.get(key) ?? opts?.initialValue) : undefined;

      const u = new URL(config.url);
      const headers = new Headers();
      if (u.username || u.password) {
        headers.set(
          "authorization",
          `Basic ${Buffer.from(`${decodeURIComponent(u.username)}:${decodeURIComponent(u.password)}`).toString("base64")}`,
        );
        u.username = "";
        u.password = "";
      }
      u.searchParams.set("default_format", "JSONEachRow");

      const where =
        cursorField && cursor !== undefined
          ? ` WHERE ${quote(cursorField)} > ${literal(cursor)}`
          : "";
      const order = cursorField ? ` ORDER BY ${quote(cursorField)} ASC` : "";
      const body = `SELECT * FROM ${quote(table)}${where}${order} FORMAT JSONEachRow`;
      const res = await fetch(u, { method: "POST", body, headers });
      if (!res.ok || !res.body) throw new Error(`clickhouse: ${res.status} ${await res.text()}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let batch: Row[] = [];
      let maxCursor: unknown;
      const trackCursor = (row: Row): void => {
        if (!cursorField) return;
        const v = row[cursorField];
        if (v === undefined || v === null) return;
        if (maxCursor === undefined || String(v) > String(maxCursor)) maxCursor = v;
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx = buf.indexOf("\n");
        while (idx >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line) {
            const row = JSON.parse(line) as Row;
            trackCursor(row);
            batch.push(row);
          }
          if (batch.length >= 5000) {
            yield batch;
            batch = [];
          }
          idx = buf.indexOf("\n");
        }
      }
      if (buf.trim()) {
        const row = JSON.parse(buf) as Row;
        trackCursor(row);
        batch.push(row);
      }
      if (batch.length) yield batch;
      if (cursorField && maxCursor !== undefined) state.set(key, String(maxCursor));
    },
    async close() {},
  };
}

function quote(name: string): string {
  return name
    .split(".")
    .map((part) => `\`${part.replace(/`/g, "``")}\``)
    .join(".");
}

function literal(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
