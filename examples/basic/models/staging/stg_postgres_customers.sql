{{ config(
  materialized: "view"
) }}

with

  customers as (select * from {{ source("postgres", "customers") }}),

  final as (

    select
      id,
      name,
      email,
      created_at
      
    from customers

  )

select * from final
