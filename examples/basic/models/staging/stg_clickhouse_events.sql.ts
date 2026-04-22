import { source, sql } from "@otter/core";

export const config = { materialized: "view" } as const;

export default sql`
select
  id,
  user_id,
  event_type,
  page_url,
  created_at
from ${source("clickhouse", "events")}
`;
