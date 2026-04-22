{{ config(
  materialized: "view"
) }}

with

  customers as (select * from {{ source("stripe", "customers") }}),

  final as (

    select
      id,
      email,
      name,
      currency,
      livemode,
      to_timestamp(created) as created_at

    from customers

  )

select * from final
