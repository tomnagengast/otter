import type { CursorState, ExtractOpts, ExtractStream, Row, Source } from "@otter/core";

const DEFAULT_BASE_URL = "https://api.stripe.com";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_API_VERSION = "2025-04-30.basil";
const MAX_RETRIES = 5;
const DEFAULT_CURSOR_FIELD = "created";

export interface StripeSourceOptions {
  /** Stripe secret key (sk_live_... / sk_test_...). Falls back to `STRIPE_API_KEY`. */
  apiKey?: string;
  /** Override the API base URL. Primarily useful for tests. */
  baseUrl?: string;
  /** Pin a Stripe API version. Defaults to a recent GA release. */
  apiVersion?: string;
  /** Act on behalf of a connected account via `Stripe-Account`. */
  stripeAccount?: string;
  /** Page size for list endpoints (1-100). Defaults to 100. */
  pageSize?: number;
}

interface StripeListResponse {
  object: "list";
  url: string;
  has_more: boolean;
  data: Row[];
}

export function stripeSource(options: StripeSourceOptions = {}): Source {
  const apiKey = options.apiKey ?? process.env.STRIPE_API_KEY;
  if (!apiKey) {
    throw new Error(
      "source-stripe: apiKey is required (set options.apiKey or STRIPE_API_KEY env var)",
    );
  }
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const apiVersion = options.apiVersion ?? DEFAULT_API_VERSION;
  const pageSize = clampPageSize(options.pageSize ?? DEFAULT_PAGE_SIZE);

  const headers = new Headers({
    authorization: `Bearer ${apiKey}`,
    "stripe-version": apiVersion,
  });
  if (options.stripeAccount) headers.set("stripe-account", options.stripeAccount);

  return {
    kind: "stripe",
    async extract(stream: string, state: CursorState, opts?: ExtractOpts): Promise<ExtractStream> {
      const resource = (opts?.identifier ?? stream).replace(/^\/+|\/+$/g, "");
      const cursorField = opts?.cursorField ?? DEFAULT_CURSOR_FIELD;
      const stateKey = `${stream}:${cursorField}`;
      const initial = state.get(stateKey) ?? opts?.initialValue;
      const cursorFilter = cursorField === DEFAULT_CURSOR_FIELD ? initial : undefined;

      async function* rows(): AsyncGenerator<Row[]> {
        let maxCursor: number | undefined = toUnixSeconds(initial);
        let startingAfter: string | undefined;
        while (true) {
          const params = new URLSearchParams();
          params.set("limit", String(pageSize));
          if (startingAfter) params.set("starting_after", startingAfter);
          if (cursorFilter !== undefined) {
            params.set(`${DEFAULT_CURSOR_FIELD}[gt]`, String(toUnixSeconds(cursorFilter) ?? 0));
          }
          const url = `${baseUrl}/v1/${resource}?${params.toString()}`;
          const page = await request(url, headers);
          if (page.data.length === 0) break;
          for (const row of page.data) {
            const v = row[cursorField];
            if (typeof v === "number" && (maxCursor === undefined || v > maxCursor)) {
              maxCursor = v;
            }
          }
          yield page.data;
          if (!page.has_more) break;
          const last = page.data[page.data.length - 1];
          const lastId = last && typeof last.id === "string" ? (last.id as string) : undefined;
          if (!lastId) break;
          startingAfter = lastId;
        }
        if (maxCursor !== undefined) state.set(stateKey, String(maxCursor));
      }

      const iterator = rows();
      const first = await iterator.next();
      const columnTypes = first.done ? {} : inferColumnTypes(first.value);

      async function* combined(): AsyncGenerator<Row[]> {
        if (!first.done) yield normalizeBatch(first.value, columnTypes);
        for await (const batch of iterator) yield normalizeBatch(batch, columnTypes);
      }

      return { columnTypes, rows: combined() };
    },
    async close() {},
  };
}

async function request(url: string, headers: Headers): Promise<StripeListResponse> {
  let attempt = 0;
  while (true) {
    const res = await fetch(url, { headers });
    if (res.ok) return (await res.json()) as StripeListResponse;
    if (shouldRetry(res.status) && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const delayMs =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : Math.min(30_000, 500 * 2 ** attempt);
      await Bun.sleep(delayMs);
      attempt += 1;
      continue;
    }
    const body = await res.text();
    throw new Error(`stripe: ${res.status} ${res.statusText} — ${body}`);
  }
}

function shouldRetry(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function clampPageSize(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_PAGE_SIZE;
  const v = Math.floor(n);
  if (v < 1) return 1;
  if (v > 100) return 100;
  return v;
}

function toUnixSeconds(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (/^\d+$/.test(value)) return Number(value);
  const t = Date.parse(value);
  if (Number.isNaN(t)) return undefined;
  return Math.floor(t / 1000);
}

function inferColumnTypes(batch: Row[]): Record<string, string> {
  const types: Record<string, string> = {};
  for (const row of batch) {
    for (const [k, v] of Object.entries(row)) {
      const existing = types[k];
      const next = pgTypeOf(v);
      types[k] = widen(existing, next);
    }
  }
  for (const k of Object.keys(types)) {
    if (types[k] === "unknown") types[k] = "text";
  }
  return types;
}

function pgTypeOf(v: unknown): string {
  if (v === null || v === undefined) return "unknown";
  if (typeof v === "boolean") return "boolean";
  if (typeof v === "number") return Number.isInteger(v) ? "bigint" : "double precision";
  if (typeof v === "string") return "text";
  return "jsonb";
}

const PRECEDENCE: Record<string, number> = {
  unknown: 0,
  boolean: 1,
  bigint: 2,
  "double precision": 3,
  text: 4,
  jsonb: 5,
};

function widen(a: string | undefined, b: string): string {
  if (!a || a === "unknown") return b;
  if (b === "unknown") return a;
  if (a === b) return a;
  if (
    (a === "bigint" && b === "double precision") ||
    (a === "double precision" && b === "bigint")
  ) {
    return "double precision";
  }
  return (PRECEDENCE[a] ?? 4) >= (PRECEDENCE[b] ?? 4) ? a : b;
}

function normalizeBatch(batch: Row[], columnTypes: Record<string, string>): Row[] {
  return batch.map((row) => {
    const out: Row = {};
    for (const [k, v] of Object.entries(row)) {
      if (v !== null && typeof v === "object" && columnTypes[k] === "jsonb") {
        out[k] = JSON.stringify(v);
      } else {
        out[k] = v;
      }
    }
    return out;
  });
}
