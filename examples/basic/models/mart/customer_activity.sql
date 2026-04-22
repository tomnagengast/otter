{{ config(
  materialized: "table",
  columns: {
      customer_id: { tests: ["unique", "not_null"] },
      customer_source: { tests: ["not_null"] },
  }
) }}

with

  customers as (select * from {{ ref("customers") }}),

  events as (select * from {{ ref("stg_clickhouse_events") }}),

  stg_postgres_orders as (select * from {{ ref("stg_postgres_orders") }}),

  stg_seed_orders as (select * from {{ ref("stg_seed_orders") }}),

  stg_stripe_customers as (select * from {{ ref("stg_stripe_customers") }}),

  stg_stripe_charges as (select * from {{ ref("stg_stripe_charges") }}),

  stg_stripe_subscriptions as (select * from {{ ref("stg_stripe_subscriptions") }}),

  postgres_orders as (

    select
      id,
      md5(customer_id::text || 'postgres') as customer_id,
      amount,
      created_at,
      'postgres' as source
    from stg_postgres_orders

  ),

  seed_orders as (

    select
      id,
      md5(customer_id::text || 'seed') as customer_id,
      amount,
      null::timestamptz as created_at,
      'seed' as source
    from stg_seed_orders

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
      md5(user_id::text || 'postgres') as customer_id,
      count(*) as event_count,
      count(*) filter (where event_type = 'page_view') as page_views,
      count(*) filter (where event_type = 'click') as clicks,
      count(*) filter (where event_type = 'purchase') as purchases,
      max(created_at) as last_event_at

    from events
    group by 1

  ),

  stripe_charges_by_email as (

    select
      stripe_customers.email,
      count(*) as stripe_charge_count,
      sum(stg_stripe_charges.amount_cents) filter (
        where stg_stripe_charges.paid
      ) as stripe_paid_cents,
      sum(stg_stripe_charges.amount_refunded_cents) as stripe_refunded_cents,
      max(stg_stripe_charges.created_at) as last_stripe_charge_at

    from stg_stripe_charges
    inner join stg_stripe_customers as stripe_customers
      on stripe_customers.id = stg_stripe_charges.customer_id
    where stripe_customers.email is not null
    group by 1

  ),

  stripe_subscriptions_by_email as (

    select
      stripe_customers.email,
      count(*) as stripe_subscription_count,
      count(*) filter (where stg_stripe_subscriptions.status = 'active')
        as active_stripe_subscriptions,
      max(stg_stripe_subscriptions.created_at) as last_stripe_subscription_at

    from stg_stripe_subscriptions
    inner join stg_stripe_customers as stripe_customers
      on stripe_customers.id = stg_stripe_subscriptions.customer_id
    where stripe_customers.email is not null
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
      e.last_event_at,
      coalesce(sc.stripe_charge_count, 0) as stripe_charge_count,
      coalesce(sc.stripe_paid_cents, 0) as stripe_paid_cents,
      coalesce(sc.stripe_refunded_cents, 0) as stripe_refunded_cents,
      sc.last_stripe_charge_at,
      coalesce(ss.stripe_subscription_count, 0) as stripe_subscription_count,
      coalesce(ss.active_stripe_subscriptions, 0) as active_stripe_subscriptions,
      ss.last_stripe_subscription_at

    from customers c
    left join customer_orders o on o.customer_id = c.id
    left join customer_events e on e.customer_id = c.id
    left join stripe_charges_by_email sc on sc.email = c.email
    left join stripe_subscriptions_by_email ss on ss.email = c.email
    order by c.id

  )

select * from final
