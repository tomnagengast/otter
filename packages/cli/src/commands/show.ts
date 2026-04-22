import { defineCommand } from "../argv.ts";

export const showCommand = defineCommand({
  name: "show",
  summary: "Preview post-transform rows for a model",
  flags: {
    profile: { type: "string", default: "dev" },
    limit: { type: "string", default: "10" },
  },
  async run({ values, positionals }) {
    console.log("[stub] show", { values, positionals });
    return 0;
  },
});
