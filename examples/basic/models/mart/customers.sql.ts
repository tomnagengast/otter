import { ref, sql } from "@otter/core";

export const config = { materialized: "table" } as const;

export default sql`
select
  id,
  name,
  email,
  created_at
from ${ref("stg_postgres_customers")}
`;
