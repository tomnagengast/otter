{{ config(
  materialized: "table"
) }}

with

  customers as (select * from {{ ref("customers") }}),

  events as (select * from {{ ref("stg_clickhouse_events") }}),

  postgres_orders as (select * from {{ ref("stg_postgres_orders") }}),

  seed_orders as (select * from {{ ref("stg_seed_orders") }}),

  postgres_orders as (

    select
      id,
      customer_id,
      amount,
      created_at,
      'postgres' as source
    from postgres_orders

  ),

  seed_orders as (

    select
      id,
      customer_id,
      amount,
      null as created_at,
      'seed' as source
    from seed_orders

  ),

  orders as (

    select * from postgres_orders
    union all
    select * from seed_orders

  ),

  customer_orders as (

    select
      customer_id,
      count(*) as order_count,
      sum(amount) as total_spent,
      max(created_at) as last_order_at

    from orders
    group by 1

  ),

  customer_events as (

    select
      user_id as customer_id,
      count(*) as event_count,
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type = 'click') as clicks,
      count(*) filter (where event_type = 'purchase') as purchases,
      max(created_at) as last_event_at

    from events
    group by 1

  ),

  final as (

    select
      c.id as customer_id,
      c.name,
      c.email,
      c.source as customer_source,
      c.created_at as customer_since,
      coalesce(o.order_count, 0) as order_count,
      coalesce(o.total_spent, 0) as total_spent,
      o.last_order_at,
      coalesce(e.event_count, 0) as event_count,
      coalesce(e.page_views, 0) as page_views,
      coalesce(e.clicks, 0) as clicks,
      coalesce(e.purchases, 0) as purchases,
      e.last_event_at

    from customers c
    left join customer_orders o on o.customer_id = c.id
    left join customer_events e on e.customer_id = c.id
    order by c.id

  )

select * from final
