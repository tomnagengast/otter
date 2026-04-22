import { defineCommand } from "../argv.ts";

export const cleanCommand = defineCommand({
  name: "clean",
  summary: "Remove .otter/target/",
  flags: {},
  async run({ values, positionals }) {
    console.log("[stub] clean", { values, positionals });
    return 0;
  },
});
