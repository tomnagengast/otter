{{ config(
  materialized: "view"
) }}

with

  customers as (select * from {{ ref("customers") }}),

  orders as (
    select
      id,
      md5(customer_id::text || 'postgres') as customer_id,
      amount
    from {{ ref("stg_postgres_orders") }}
  ),

  final as (

    select
      c.id as customer_id,
      c.name,
      count(o.id) as order_count,
      coalesce(sum(o.amount), 0) as total_amount

    from customers as c
    left join orders as o on o.customer_id = c.id
    group by 1, 2
    order by total_amount desc

  )

select * from final
