{{ config(
  materialized: "view"
) }}

with

  charges as (select * from {{ source("stripe", "charges") }}),

  final as (

    select
      id,
      customer as customer_id,
      amount as amount_cents,
      amount_refunded as amount_refunded_cents,
      currency,
      status,
      paid,
      captured,
      refunded,
      disputed,
      to_timestamp(created) as created_at

    from charges

  )

select * from final
