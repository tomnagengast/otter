{{ config(
  materialized: "view"
) }}

with

  customers as (select * from {{ ref("customers") }}),

  orders as (select * from {{ ref("stg_postgres_orders") }}),

  final as (

    select
      c.id as customer_id,
      c.name,
      count(o.id) as order_count,
      coalesce(sum(o.amount), 0) as total_amount
      
    from customers c
    left join orders o on o.customer_id = c.id
    group by c.id, c.name
    order by total_amount desc

  )

select * from final
