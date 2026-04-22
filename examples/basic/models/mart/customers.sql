{{ config(
  materialized: "table"
) }}

with

  postgres_customers as (select * from {{ ref("stg_postgres_customers") }}),

  seed_customers as (select * from {{ ref("stg_seed_customers") }}),

  final as (

    select
      md5(id || 'postgres') as id,
      name,
      email,
      created_at,
      'postgres' as source

    from postgres_customers

    union all

    select
      md5(id || 'seed') as id,
      name,
      email,
      null as created_at,
      'seed' as source

    from seed_customers

  )

select * from final
