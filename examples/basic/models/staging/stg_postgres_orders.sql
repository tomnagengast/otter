{{ config(
  materialized: "view"
) }}

with

  orders as (select * from {{ source("postgres", "orders") }}),

  final as (

    select
      id,
      customer_id,
      amount,
      status,
      created_at
      
    from orders

  )

select * from final
