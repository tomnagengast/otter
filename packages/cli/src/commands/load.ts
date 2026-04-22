import { defineCommand } from "../argv.ts";

export const loadCommand = defineCommand({
  name: "load",
  summary: "Extract from source and load to local Postgres raw table",
  flags: {
    profile: { type: "string", default: "dev" },
    strategy: { type: "string", default: "append" },
    "unique-key": { type: "string" },
  },
  async run({ values, positionals }) {
    console.log("[stub] load", { values, positionals });
    return 0;
  },
});
