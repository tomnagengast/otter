{{ config(
  materialized: "view"
) }}

with

  subscriptions as (select * from {{ source("stripe", "subscriptions") }}),

  final as (

    select
      id,
      customer as customer_id,
      status,
      currency,
      cancel_at_period_end,
      to_timestamp(created) as created_at,
      to_timestamp(start_date) as started_at,
      case when canceled_at is not null then to_timestamp(canceled_at::bigint) end as canceled_at,
      case when ended_at is not null then to_timestamp(ended_at::bigint) end as ended_at

    from subscriptions

  )

select * from final
