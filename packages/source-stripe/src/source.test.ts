import { expect, test } from "bun:test";
import { createSource } from "./index.ts";

interface StripeObject {
  id: string;
  object: string;
  created: number;
  livemode?: boolean;
  [key: string]: unknown;
}

function listResponse(data: StripeObject[], hasMore = false): Response {
  return new Response(JSON.stringify({ object: "list", url: "/v1/x", has_more: hasMore, data }), {
    headers: { "content-type": "application/json" },
  });
}

test("paginates until has_more is false and sets cursor to max created", async () => {
  const requests: URL[] = [];
  const server = Bun.serve({
    port: 0,
    async fetch(req) {
      const u = new URL(req.url);
      requests.push(u);
      if (u.searchParams.get("starting_after") === "cu_2") {
        return listResponse([{ id: "cu_3", object: "customer", created: 300, email: "c@x.io" }]);
      }
      return listResponse(
        [
          { id: "cu_1", object: "customer", created: 100, email: "a@x.io" },
          { id: "cu_2", object: "customer", created: 200, email: "b@x.io" },
        ],
        true,
      );
    },
  });

  try {
    const store = new Map<string, string>();
    const state = {
      get: (k: string) => store.get(k),
      set: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const src = createSource({
      kind: "stripe",
      options: { apiKey: "sk_test_x", baseUrl: `http://127.0.0.1:${server.port}` },
    });
    const { columnTypes, rows } = await src.extract("customers", state);
    const batches: Record<string, unknown>[][] = [];
    for await (const b of rows) batches.push(b);

    expect(requests.length).toBe(2);
    expect(requests[0]?.pathname).toBe("/v1/customers");
    expect(requests[0]?.searchParams.get("limit")).toBe("100");
    expect(requests[0]?.searchParams.get("starting_after")).toBeNull();
    expect(requests[1]?.searchParams.get("starting_after")).toBe("cu_2");
    expect(batches.flat().map((r) => r.id)).toEqual(["cu_1", "cu_2", "cu_3"]);
    expect(columnTypes).toEqual({
      id: "text",
      object: "text",
      created: "bigint",
      email: "text",
    });
    expect(store.get("customers:created")).toBe("300");
    await src.close();
  } finally {
    await server.stop();
  }
});

test("passes created[gt] filter from prior cursor state", async () => {
  const captured: { filter: string | null } = { filter: null };
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      captured.filter = new URL(req.url).searchParams.get("created[gt]");
      return listResponse([]);
    },
  });
  try {
    const store = new Map<string, string>([["customers:created", "12345"]]);
    const state = {
      get: (k: string) => store.get(k),
      set: (k: string, v: string) => {
        store.set(k, v);
      },
    };
    const src = createSource({
      kind: "stripe",
      options: { apiKey: "sk_test_x", baseUrl: `http://127.0.0.1:${server.port}` },
    });
    const { rows } = await src.extract("customers", state);
    for await (const _ of rows) {
      /* drain */
    }
    expect(captured.filter).toBe("12345");
    await src.close();
  } finally {
    await server.stop();
  }
});

test("authorization and stripe-version headers", async () => {
  const captured: { auth: string | null; version: string | null; account: string | null } = {
    auth: null,
    version: null,
    account: null,
  };
  const server = Bun.serve({
    port: 0,
    fetch(req) {
      captured.auth = req.headers.get("authorization");
      captured.version = req.headers.get("stripe-version");
      captured.account = req.headers.get("stripe-account");
      return listResponse([]);
    },
  });
  try {
    const noop = { get: () => undefined, set: () => {} };
    const src = createSource({
      kind: "stripe",
      options: {
        apiKey: "sk_test_abc",
        baseUrl: `http://127.0.0.1:${server.port}`,
        apiVersion: "2024-06-20",
        stripeAccount: "acct_123",
      },
    });
    const { rows } = await src.extract("charges", noop);
    for await (const _ of rows) {
      /* drain */
    }
    expect(captured.auth).toBe("Bearer sk_test_abc");
    expect(captured.version).toBe("2024-06-20");
    expect(captured.account).toBe("acct_123");
    await src.close();
  } finally {
    await server.stop();
  }
});

test("widens column types across a batch and stores nested values as jsonb", async () => {
  const server = Bun.serve({
    port: 0,
    fetch() {
      return listResponse([
        {
          id: "ch_1",
          object: "charge",
          created: 100,
          amount: 1000,
          livemode: false,
          metadata: { source: "web" },
        },
        {
          id: "ch_2",
          object: "charge",
          created: 200,
          amount: 99.5,
          livemode: true,
          metadata: { source: "mobile", trace: [1, 2] },
        },
      ]);
    },
  });
  try {
    const noop = { get: () => undefined, set: () => {} };
    const src = createSource({
      kind: "stripe",
      options: { apiKey: "sk_test_x", baseUrl: `http://127.0.0.1:${server.port}` },
    });
    const { columnTypes, rows } = await src.extract("charges", noop);
    const all: Record<string, unknown>[] = [];
    for await (const b of rows) all.push(...b);

    expect(columnTypes.amount).toBe("double precision");
    expect(columnTypes.livemode).toBe("boolean");
    expect(columnTypes.metadata).toBe("jsonb");
    expect(typeof all[0]?.metadata).toBe("string");
    expect(JSON.parse(all[0]?.metadata as string)).toEqual({ source: "web" });
    await src.close();
  } finally {
    await server.stop();
  }
});

test("retries on 429 using retry-after header", async () => {
  let calls = 0;
  const server = Bun.serve({
    port: 0,
    fetch() {
      calls += 1;
      if (calls === 1) {
        return new Response("rate limited", {
          status: 429,
          headers: { "retry-after": "0" },
        });
      }
      return listResponse([{ id: "cu_1", object: "customer", created: 1 }]);
    },
  });
  try {
    const noop = { get: () => undefined, set: () => {} };
    const src = createSource({
      kind: "stripe",
      options: { apiKey: "sk_test_x", baseUrl: `http://127.0.0.1:${server.port}` },
    });
    const { rows } = await src.extract("customers", noop);
    const all: Record<string, unknown>[] = [];
    for await (const b of rows) all.push(...b);
    expect(calls).toBe(2);
    expect(all.length).toBe(1);
    await src.close();
  } finally {
    await server.stop();
  }
});

test("throws when apiKey is missing", () => {
  const previous = process.env.STRIPE_API_KEY;
  delete process.env.STRIPE_API_KEY;
  try {
    expect(() => createSource({ kind: "stripe" })).toThrow(/apiKey is required/);
  } finally {
    if (previous !== undefined) process.env.STRIPE_API_KEY = previous;
  }
});
