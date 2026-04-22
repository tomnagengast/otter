import { defineCommand } from "../argv.ts";

export const listCommand = defineCommand({
  name: "list",
  summary: "Enumerate registered models, sources, or seeds",
  flags: {
    profile: { type: "string", default: "dev" },
  },
  async run({ values, positionals }) {
    console.log("[stub] list", { values, positionals });
    return 0;
  },
});
