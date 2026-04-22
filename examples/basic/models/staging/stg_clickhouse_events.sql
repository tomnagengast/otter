{{ config(
  materialized: "view"
) }}

with

  events as (select * from {{ source("clickhouse", "events") }}),

  final as (

    select
      id,
      user_id,
      event_type,
      page_url,
      created_at
      
    from events

  )

select * from final
