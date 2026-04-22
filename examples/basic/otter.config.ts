import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: {
    dev: {
      target: {
        kind: "postgres",
        url: process.env.ANALYTICS_PG_URL ?? "postgres://postgres:otter@localhost:5433/analytics",
        schema: "analytics",
      },
    },
  },
  sources: {
    postgres: {
      kind: "postgres",
      url: process.env.SOURCE_PG_URL ?? "postgres://postgres:otter@localhost:5432/postgres",
    },
    clickhouse: {
      kind: "clickhouse",
      url: process.env.CLICKHOUSE_URL ?? "http://otter:otter@localhost:8123",
    },
  },
  modelsDir: "models",
  seedsDir: "seeds",
});
