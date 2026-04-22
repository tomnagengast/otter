import type { Row, Source } from "@otter/core";

export function createSource(config: { url: string }): Source {
  return {
    kind: "clickhouse",
    async *extract(stream) {
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
      const body = `SELECT * FROM ${quote(stream)} FORMAT JSONEachRow`;
      const res = await fetch(u, { method: "POST", body, headers });
      if (!res.ok || !res.body) throw new Error(`clickhouse: ${res.status} ${await res.text()}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let batch: Row[] = [];
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx = buf.indexOf("\n");
        while (idx >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          if (line) batch.push(JSON.parse(line) as Row);
          if (batch.length >= 5000) {
            yield batch;
            batch = [];
          }
          idx = buf.indexOf("\n");
        }
      }
      if (buf.trim()) batch.push(JSON.parse(buf) as Row);
      if (batch.length) yield batch;
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
