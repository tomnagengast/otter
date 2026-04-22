import { Glob } from "bun";
import type { Adapter, LoadResult } from "./adapter.ts";
import type { Row } from "./source.ts";

export interface SeedFile {
  name: string;
  file: string;
  path: string;
}

export async function discoverSeeds(cwd: string, seedsDir: string): Promise<SeedFile[]> {
  const root = `${cwd}/${seedsDir}`;
  const glob = new Glob("**/*.csv");
  const seeds: SeedFile[] = [];
  for await (const f of glob.scan(root)) {
    const stem = f.replace(/\.csv$/i, "").replaceAll("/", "_");
    seeds.push({ name: `seed_${stem}`, file: f, path: `${root}/${f}` });
  }
  seeds.sort((a, b) => a.name.localeCompare(b.name));
  return seeds;
}

export function parseCsv(text: string): { columns: string[]; rows: Row[] } {
  const records = parseRecords(text);
  if (records.length === 0) return { columns: [], rows: [] };
  const columns = records[0] as string[];
  const rows: Row[] = [];
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (record.length === 1 && record[0] === "") continue;
    const row: Row = {};
    for (let c = 0; c < columns.length; c++) {
      row[columns[c] as string] = record[c] ?? null;
    }
    rows.push(row);
  }
  return { columns, rows };
}

function parseRecords(text: string): string[][] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      record.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      i++;
      continue;
    }
    if (ch === "\n") {
      record.push(field);
      records.push(record);
      field = "";
      record = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  if (field.length > 0 || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  return records;
}

export interface LoadSeedsResult {
  files: { name: string; rows: number; duration_ms: number }[];
}

export async function loadSeeds(opts: {
  adapter: Adapter;
  schema: string;
  seeds: SeedFile[];
}): Promise<LoadSeedsResult> {
  const results: LoadSeedsResult["files"] = [];
  for (const seed of opts.seeds) {
    const text = await Bun.file(seed.path).text();
    const { rows } = parseCsv(text);
    const target = { schema: opts.schema, name: seed.name };
    const result: LoadResult = await opts.adapter.bulkLoad(
      target,
      (async function* () {
        if (rows.length > 0) yield rows;
      })(),
      "replace",
    );
    results.push({ name: seed.name, rows: result.rows, duration_ms: result.duration_ms });
  }
  return { files: results };
}
