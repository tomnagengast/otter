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

export function parseCsv(text: string): {
  columns: string[];
  rows: Row[];
  columnTypes: Record<string, string>;
} {
  const records = parseRecords(text);
  if (records.length === 0) return { columns: [], rows: [], columnTypes: {} };
  const columns = records[0] as string[];
  const raw: (string | null)[][] = [];
  for (let i = 1; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (record.length === 1 && record[0] === "") continue;
    const normalized: (string | null)[] = [];
    for (let c = 0; c < columns.length; c++) {
      const v = record[c];
      normalized.push(v === undefined || v === "" ? null : v);
    }
    raw.push(normalized);
  }
  const columnTypes: Record<string, string> = {};
  for (let c = 0; c < columns.length; c++) {
    const col = columns[c] as string;
    const values: string[] = [];
    for (const row of raw) {
      const v = row[c];
      if (v != null) values.push(v);
    }
    columnTypes[col] = inferColumnType(values);
  }
  const rows: Row[] = raw.map((record) => {
    const row: Row = {};
    for (let c = 0; c < columns.length; c++) {
      row[columns[c] as string] = record[c];
    }
    return row;
  });
  return { columns, rows, columnTypes };
}

type ValueKind = "bigint" | "numeric" | "boolean" | "date" | "timestamptz" | "text";

const INT64_MIN = -9223372036854775808n;
const INT64_MAX = 9223372036854775807n;

function classifyValue(v: string): ValueKind {
  const lower = v.toLowerCase();
  if (lower === "true" || lower === "false") return "boolean";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return "date";
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/.test(v)) {
    return "timestamptz";
  }
  if (/^-?\d+$/.test(v)) {
    try {
      const n = BigInt(v);
      if (n >= INT64_MIN && n <= INT64_MAX) return "bigint";
    } catch {}
    return "numeric";
  }
  if (/^-?(\d+\.\d*|\.\d+|\d+\.\d+)$/.test(v)) return "numeric";
  return "text";
}

export function inferColumnType(values: string[]): string {
  const seen = new Set<ValueKind>();
  for (const v of values) seen.add(classifyValue(v));
  if (seen.size === 0) return "text";
  if (seen.size === 1) {
    const only = [...seen][0] as ValueKind;
    return only === "timestamptz" ? "timestamptz" : only;
  }
  if (seen.has("text")) return "text";
  if (seen.has("boolean")) return "text";
  if (seen.size === 2 && seen.has("bigint") && seen.has("numeric")) return "numeric";
  if (seen.size === 2 && seen.has("date") && seen.has("timestamptz")) return "timestamptz";
  return "text";
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
    const { rows, columnTypes } = parseCsv(text);
    const target = { schema: opts.schema, name: seed.name };
    const result: LoadResult = await opts.adapter.bulkLoad(
      target,
      (async function* () {
        if (rows.length > 0) yield rows;
      })(),
      "replace",
      { columnTypes },
    );
    results.push({ name: seed.name, rows: result.rows, duration_ms: result.duration_ms });
  }
  return { files: results };
}
