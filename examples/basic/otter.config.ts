import { postgresAdapter } from "@otter-sh/adapter-postgres";
import { defineConfig } from "@otter-sh/core";
import { clickhouseSource } from "@otter-sh/source-clickhouse";
import { postgresSource } from "@otter-sh/source-postgres";
import { stripeSource } from "@otter-sh/source-stripe";

export default defineConfig({
  profiles: {
    dev: {
      target: postgresAdapter({
        url: process.env.ANALYTICS_PG_URL ?? "postgres://postgres:otter@localhost:5433/analytics",
        schema: "analytics",
      }),
    },
  },
  sources: {
    postgres: postgresSource({
      url: process.env.SOURCE_PG_URL ?? "postgres://postgres:otter@localhost:5432/postgres",
    }),
    clickhouse: clickhouseSource({
      url: process.env.CLICKHOUSE_URL ?? "http://otter:otter@localhost:8123",
    }),
    stripe: stripeSource({ apiKey: process.env.STRIPE_API_KEY }),
  },
  modelsDir: "models",
  seedsDir: "seeds",
  sourcesDir: "sources",
});
