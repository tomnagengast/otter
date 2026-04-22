{{ config(
  materialized: "view"
) }}

with

  customers as (select * from {{ seed("customers") }}),

  final as (

    select
      id,
      name,
      email

    from customers

  )

select * from final
