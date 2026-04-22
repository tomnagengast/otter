import { AsyncLocalStorage } from "node:async_hooks";

export interface RecordingContext {
  deps: Set<string>;
  sources: Set<string>;
  currentModel: string;
}

const als = new AsyncLocalStorage<RecordingContext>();

export function withRecording<T>(ctx: RecordingContext, fn: () => Promise<T>): Promise<T> {
  return als.run(ctx, fn);
}

export interface SqlFragment {
  __sql: string;
}

export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlFragment {
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) out += String(values[i]);
  }
  return { __sql: out };
}

export function ref(name: string): string {
  const ctx = als.getStore();
  if (!ctx) throw new Error("ref() called outside a recording context");
  ctx.deps.add(name);
  return quoteIdentifier(name);
}

export function source(sourceName: string, stream: string): string {
  const ctx = als.getStore();
  if (!ctx) throw new Error("source() called outside a recording context");
  ctx.sources.add(`${sourceName}.${stream}`);
  return quoteIdentifier(`raw_${sourceName}_${stream}`);
}

export function quoteIdentifier(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
