#!/usr/bin/env bun
import { main } from "./index.ts";

const code = await main(Bun.argv.slice(2));
process.exit(code);
