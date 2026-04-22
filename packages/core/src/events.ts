export interface NodeEvent {
  type: "node.start" | "node.finish" | "node.error";
  id: string;
  ts: string;
  rows?: number;
  duration_ms?: number;
  error?: string;
}

export class OtterEmitter extends EventTarget {
  emitNode(event: NodeEvent): void {
    this.dispatchEvent(new CustomEvent("node", { detail: event }));
  }
  onNode(handler: (e: NodeEvent) => void): () => void {
    const wrapped = (e: Event) => handler((e as CustomEvent<NodeEvent>).detail);
    this.addEventListener("node", wrapped);
    return () => this.removeEventListener("node", wrapped);
  }
}

export function jsonlAppender(path: string, emitter: OtterEmitter): () => Promise<void> {
  const lines: string[] = [];
  const off = emitter.onNode((e) => lines.push(JSON.stringify(e)));
  return async () => {
    off();
    await Bun.write(path, `${lines.join("\n")}\n`);
  };
}
