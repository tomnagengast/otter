import type { DagNode } from "./dag.ts";

export interface CompiledTemplate {
  config: DagNode["config"];
  sql: string;
  deps: Set<string>;
  sources: Set<string>;
  seeds: Set<string>;
}

const TEMPLATE_RE = /\{\{\s*(config|ref|source|seed)\s*\(([\s\S]*?)\)\s*\}\}/g;

export function compileTemplate(body: string, modelId: string): CompiledTemplate {
  let config: DagNode["config"] = { materialized: "view" };
  let configSeen = false;
  const deps = new Set<string>();
  const sources = new Set<string>();
  const seeds = new Set<string>();

  const sql = body.replace(TEMPLATE_RE, (_, fn: string, rawArgs: string) => {
    const args = rawArgs.trim();
    switch (fn) {
      case "config": {
        if (configSeen) {
          throw new Error(`${modelId}: multiple {{ config(...) }} blocks`);
        }
        configSeen = true;
        config = parseConfig(args, modelId);
        return "";
      }
      case "ref": {
        const [name] = parseStringArgs(args, modelId, "ref", 1) as [string];
        deps.add(name);
        return quoteIdentifier(name);
      }
      case "source": {
        const [sourceName, stream] = parseStringArgs(args, modelId, "source", 2) as [
          string,
          string,
        ];
        sources.add(`${sourceName}.${stream}`);
        return quoteIdentifier(`raw_${sourceName}_${stream}`);
      }
      case "seed": {
        const [name] = parseStringArgs(args, modelId, "seed", 1) as [string];
        seeds.add(name);
        return quoteIdentifier(`seed_${name}`);
      }
      default:
        return "";
    }
  });

  return { config, sql, deps, sources, seeds };
}

function parseConfig(body: string, modelId: string): DagNode["config"] {
  const source = body.length === 0 ? "{}" : `({${body}})`;
  let parsed: unknown;
  try {
    parsed = new Function(`return ${source};`)();
  } catch (err) {
    throw new Error(`${modelId}: invalid {{ config(...) }} body: ${(err as Error).message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${modelId}: {{ config(...) }} must be an object literal`);
  }
  const obj = parsed as Record<string, unknown>;
  const materialized = obj.materialized ?? "view";
  if (materialized !== "view" && materialized !== "table" && materialized !== "incremental") {
    throw new Error(`${modelId}: invalid materialized "${String(materialized)}"`);
  }
  const out: DagNode["config"] = { materialized };
  if (obj.unique_key !== undefined) {
    if (typeof obj.unique_key !== "string") {
      throw new Error(`${modelId}: unique_key must be a string`);
    }
    out.unique_key = obj.unique_key;
  }
  if (obj.tags !== undefined) {
    if (!Array.isArray(obj.tags) || !obj.tags.every((t) => typeof t === "string")) {
      throw new Error(`${modelId}: tags must be string[]`);
    }
    out.tags = obj.tags as string[];
  }
  return out;
}

function parseStringArgs(body: string, modelId: string, fn: string, arity: number): string[] {
  let parsed: unknown;
  try {
    parsed = new Function(`return [${body}];`)();
  } catch (err) {
    throw new Error(`${modelId}: invalid {{ ${fn}(...) }} args: ${(err as Error).message}`);
  }
  if (!Array.isArray(parsed) || parsed.length !== arity) {
    throw new Error(`${modelId}: {{ ${fn}(...) }} expects ${arity} argument(s)`);
  }
  for (const v of parsed) {
    if (typeof v !== "string") {
      throw new Error(`${modelId}: {{ ${fn}(...) }} arguments must be strings`);
    }
  }
  return parsed as string[];
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
