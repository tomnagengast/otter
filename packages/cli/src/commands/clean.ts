import { $ } from "bun";
import { defineCommand } from "../argv.ts";

export const cleanCommand = defineCommand({
  name: "clean",
  summary: "Remove .otter/target/",
  usage: "",
  flags: {},
  async run() {
    await $`rm -rf .otter/target`;
    return 0;
  },
});
