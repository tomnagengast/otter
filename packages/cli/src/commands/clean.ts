import { $ } from "bun";
import { defineCommand } from "../argv.ts";

export const cleanCommand = defineCommand({
  name: "clean",
  summary: "Remove .otter/target/ and .otter/compiled/",
  usage: "",
  flags: {},
  async run() {
    await $`rm -rf .otter/target .otter/compiled`;
    return 0;
  },
});
