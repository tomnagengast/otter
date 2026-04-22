import { source, sql } from "@otter/core";

export const config = { materialized: "table" } as const;
export default sql`select * from ${source("stripe_pg", "charges")}`;
