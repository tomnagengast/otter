import type { Adapter } from "./adapter.ts";
import type { Manifest } from "./compile.ts";
import type { ColumnTest } from "./dag.ts";
import { OtterEmitter } from "./events.ts";

export interface TestResult {
  model: string;
  column: string;
  test: ColumnTest;
  status: "pass" | "fail" | "error";
  duration_ms: number;
  failures?: number;
  error?: string;
}

export interface RunTestsOpts {
  manifest: Manifest;
  adapter: Adapter;
  schema: string;
  selected?: Set<string>;
  emitter?: OtterEmitter;
}

export interface RunTestsResults {
  tests: TestResult[];
}

export async function runModelTests(opts: RunTestsOpts): Promise<RunTestsResults> {
  const emitter = opts.emitter ?? new OtterEmitter();
  const results: TestResult[] = [];
  for (const nodeId of opts.manifest.order) {
    if (opts.selected && !opts.selected.has(nodeId)) continue;
    const node = opts.manifest.nodes[nodeId];
    if (!node?.config.columns) continue;
    for (const [column, cfg] of Object.entries(node.config.columns)) {
      for (const test of cfg.tests ?? []) {
        const testId = `${node.id}.${column}.${test}`;
        const started = performance.now();
        emitter.emitNode({ type: "node.start", id: testId, ts: new Date().toISOString() });
        try {
          const failures = await runTest(opts.adapter, opts.schema, node.id, column, test);
          const duration_ms = performance.now() - started;
          const status = failures === 0 ? "pass" : "fail";
          results.push({
            model: node.id,
            column,
            test,
            status,
            failures,
            duration_ms,
          });
          emitter.emitNode({
            type: status === "pass" ? "node.finish" : "node.error",
            id: testId,
            ts: new Date().toISOString(),
            duration_ms,
            error: status === "fail" ? `${failures} row(s) failed` : undefined,
          });
        } catch (err) {
          const duration_ms = performance.now() - started;
          const message = err instanceof Error ? err.message : String(err);
          results.push({
            model: node.id,
            column,
            test,
            status: "error",
            duration_ms,
            error: message,
          });
          emitter.emitNode({
            type: "node.error",
            id: testId,
            ts: new Date().toISOString(),
            duration_ms,
            error: message,
          });
        }
      }
    }
  }
  return { tests: results };
}

async function runTest(
  adapter: Adapter,
  schema: string,
  model: string,
  column: string,
  test: ColumnTest,
): Promise<number> {
  const sql = renderTestSql(schema, model, column, test);
  const result = await adapter.execute(sql);
  const row = result.rows?.[0];
  const raw = row ? (row.n ?? Object.values(row)[0]) : 0;
  return Number(raw ?? 0);
}

function renderTestSql(schema: string, model: string, column: string, test: ColumnTest): string {
  const table = `${quote(schema)}.${quote(model)}`;
  const col = quote(column);
  if (test === "not_null") {
    return `select count(*) as n from ${table} where ${col} is null`;
  }
  return `select count(*) as n from (select ${col} from ${table} where ${col} is not null group by ${col} having count(*) > 1) t`;
}

function quote(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
