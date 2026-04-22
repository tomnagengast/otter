import { defineCommand } from "../argv.ts";

export const compileCommand = defineCommand({
  name: "compile",
  summary: "Compile models into .otter/target/manifest.json",
  flags: {
    profile: { type: "string", default: "dev" },
  },
  async run({ values, positionals }) {
    console.log("[stub] compile", { values, positionals });
    return 0;
  },
});
