import { $ } from "bun";
import { defineCommand } from "../argv.ts";

export const cleanCommand = defineCommand({
  name: "clean",
  summary: "Remove .otter/target/",
  flags: {},
  async run() {
    await $`rm -rf .otter/target`;
    return 0;
  },
});
