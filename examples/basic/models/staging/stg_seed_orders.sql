{{ config(
  materialized: "view"
) }}

with

  orders as (select * from {{ seed("orders") }}),

  final as (

    select
      id,
      customer_id,
      amount

    from orders

  )

select * from final
