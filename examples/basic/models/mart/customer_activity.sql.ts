import { ref, sql } from "@otter/core";

export const config = { materialized: "table" } as const;

export default sql`
with customer_orders as (
  select
    customer_id,
    count(*) as order_count,
    sum(amount) as total_spent,
    max(created_at) as last_order_at
  from ${ref("stg_postgres_orders")}
  group by customer_id
),
customer_events as (
  select
    user_id as customer_id,
    count(*) as event_count,
    count(*) filter (where event_type = 'page_view') as page_views,
    count(*) filter (where event_type = 'click') as clicks,
    count(*) filter (where event_type = 'purchase') as purchases,
    max(created_at) as last_event_at
  from ${ref("stg_clickhouse_events")}
  group by user_id
)
select
  c.id as customer_id,
  c.name,
  c.email,
  c.created_at as customer_since,
  coalesce(o.order_count, 0) as order_count,
  coalesce(o.total_spent, 0) as total_spent,
  o.last_order_at,
  coalesce(e.event_count, 0) as event_count,
  coalesce(e.page_views, 0) as page_views,
  coalesce(e.clicks, 0) as clicks,
  coalesce(e.purchases, 0) as purchases,
  e.last_event_at
from ${ref("customers")} c
left join customer_orders o on o.customer_id = c.id
left join customer_events e on e.customer_id = c.id
order by c.id
`;
