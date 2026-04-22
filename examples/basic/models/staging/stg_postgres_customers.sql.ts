import { source, sql } from "@otter/core";

export const config = { materialized: "view" } as const;

export default sql`
select
  id,
  name,
  email,
  created_at
from ${source("postgres", "customers")}
`;
