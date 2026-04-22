import { ref, sql } from "@otter/core";

export const config = { materialized: "view" } as const;

export default sql`
select
  c.id as customer_id,
  c.name,
  count(o.id) as order_count,
  coalesce(sum(o.amount), 0) as total_amount
from ${ref("customers")} c
left join ${ref("stg_postgres_orders")} o on o.customer_id = c.id
group by c.id, c.name
order by total_amount desc
`;
