import type { Row, Source, SourceConfig } from "@otter/core";

export function createSource(config: SourceConfig): Source {
  if (!config.url) throw new Error("source-clickhouse: config.url is required");
  const url = config.url;
  return {
    kind: "clickhouse",
    async extract(stream, state, opts) {
      const identifier = opts?.identifier ?? stream;
      const table = opts?.schema ? `${opts.schema}.${identifier}` : identifier;
      const cursorField = opts?.cursorField;
      const key = cursorField ? `${stream}:${cursorField}` : "";
      const cursor = cursorField ? (state.get(key) ?? opts?.initialValue) : undefined;

      const u = new URL(url);
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

      const describeBody = `DESCRIBE TABLE ${quote(table)} FORMAT JSONEachRow`;
      const describeRes = await fetch(u, { method: "POST", body: describeBody, headers });
      if (!describeRes.ok) {
        throw new Error(`clickhouse: ${describeRes.status} ${await describeRes.text()}`);
      }
      const describeText = await describeRes.text();
      const columnTypes: Record<string, string> = {};
      for (const line of describeText.split("\n")) {
        if (!line.trim()) continue;
        const { name, type } = JSON.parse(line) as { name: string; type: string };
        columnTypes[name] = mapClickhouseType(type);
      }

      const where =
        cursorField && cursor !== undefined
          ? ` WHERE ${quote(cursorField)} > ${literal(cursor)}`
          : "";
      const order = cursorField ? ` ORDER BY ${quote(cursorField)} ASC` : "";
      const body = `SELECT * FROM ${quote(table)}${where}${order} FORMAT JSONEachRow`;

      async function* rows(): AsyncGenerator<Row[]> {
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
      }

      return { columnTypes, rows: rows() };
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

function mapClickhouseType(raw: string): string {
  let t = raw.trim();
  // Unwrap modifier wrappers.
  while (true) {
    const m = t.match(/^(Nullable|LowCardinality|SimpleAggregateFunction)\((.*)\)$/);
    if (!m) break;
    t = (m[2] as string).trim();
  }
  if (/^Int(8|16|32)$/.test(t) || /^UInt(8|16)$/.test(t)) return "integer";
  if (/^Int64$/.test(t) || /^UInt(32|64)$/.test(t)) return "bigint";
  if (t === "Float32") return "real";
  if (t === "Float64") return "double precision";
  if (/^Decimal(\(|32\(|64\(|128\(|256\()/.test(t) || t === "Decimal") return "numeric";
  if (t === "Bool" || t === "Boolean") return "boolean";
  if (t === "Date" || t === "Date32") return "date";
  if (/^DateTime(64)?(\(|$)/.test(t)) return "timestamptz";
  if (t === "UUID") return "uuid";
  if (t === "String" || /^FixedString\(/.test(t) || /^Enum(8|16)?\(/.test(t)) return "text";
  return "text";
}
