import { source, sql } from "@otter/core";

export const config = { materialized: "view" } as const;

export default sql`
select
  id,
  customer_id,
  amount,
  status,
  created_at
from ${source("postgres", "orders")}
`;
