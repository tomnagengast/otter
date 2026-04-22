import { defineConfig } from "@otter/core";

export default defineConfig({
  profiles: {
    dev: { target: { kind: "postgres", url: process.env.PG_DEV_URL ?? "" } },
  },
  sources: {
    stripe_pg: { kind: "postgres", url: process.env.SOURCE_PG_URL ?? "" },
  },
  modelsDir: "models",
});
