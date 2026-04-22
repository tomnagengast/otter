import { ref, sql } from "@otter/core";

export const config = { materialized: "view" } as const;
export default sql`select count(*) from ${ref("a")}`;
