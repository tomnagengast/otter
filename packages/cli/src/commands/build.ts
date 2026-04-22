import { defineCommand } from "../argv.ts";

export const buildCommand = defineCommand({
  name: "build",
  summary: "Execute DAG and materialize models",
  flags: {
    profile: { type: "string", default: "dev" },
    select: { type: "string" },
  },
  async run({ values, positionals }) {
    console.log("[stub] build", { values, positionals });
    return 0;
  },
});
