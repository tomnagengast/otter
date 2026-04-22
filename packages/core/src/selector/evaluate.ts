import type { Dag } from "../dag.ts";
import type { SelectorAst } from "./parse.ts";

export function evaluate(ast: SelectorAst, dag: Dag): Set<string> {
  if (ast.kind === "union") {
    const out = new Set<string>();
    for (const p of ast.parts) for (const id of evaluate(p, dag)) out.add(id);
    return out;
  }
  if (ast.kind === "intersection") {
    const [first, ...rest] = ast.parts.map((p) => evaluate(p, dag));
    const out = new Set<string>();
    if (!first) return out;
    for (const id of first) if (rest.every((s) => s.has(id))) out.add(id);
    return out;
  }
  // atom
  const matched = new Set<string>();
  for (const n of dag.values()) {
    if (ast.method === "tag") {
      if (n.config.tags?.includes(ast.value)) matched.add(n.id);
    } else if (ast.method === "path") {
      if (n.path.includes(ast.value)) matched.add(n.id);
    } else if (ast.method === "config.materialized") {
      if (n.config.materialized === ast.value) matched.add(n.id);
    } else {
      if (n.id === ast.value) matched.add(n.id);
    }
  }
  const out = new Set(matched);
  if (ast.ancestors) for (const id of matched) for (const a of ancestorsOf(id, dag)) out.add(a);
  if (ast.descendants) for (const id of matched) for (const d of descendantsOf(id, dag)) out.add(d);
  return out;
}

function ancestorsOf(id: string, dag: Dag): Set<string> {
  const out = new Set<string>();
  const queue = [...(dag.get(id)?.deps ?? [])];
  while (queue.length > 0) {
    const x = queue.shift();
    if (x !== undefined && !out.has(x)) {
      out.add(x);
      queue.push(...(dag.get(x)?.deps ?? []));
    }
  }
  return out;
}

function descendantsOf(id: string, dag: Dag): Set<string> {
  const out = new Set<string>();
  const queue: string[] = [];
  for (const n of dag.values()) if (n.deps.includes(id)) queue.push(n.id);
  while (queue.length > 0) {
    const x = queue.shift();
    if (x !== undefined && !out.has(x)) {
      out.add(x);
      for (const n of dag.values()) if (n.deps.includes(x)) queue.push(n.id);
    }
  }
  return out;
}
