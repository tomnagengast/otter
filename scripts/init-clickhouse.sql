-- Source data for clickhouse loader demo
-- This data gets loaded into postgres.analytics via otter load

CREATE TABLE IF NOT EXISTS default.events (
  id UInt64,
  user_id UInt32,
  event_type String,
  page_url String,
  created_at DateTime
) ENGINE = MergeTree()
ORDER BY (created_at, id);

INSERT INTO default.events (id, user_id, event_type, page_url, created_at) VALUES
  (10, 4, 'page_view', '/home', '2026-04-14 12:00:00'),
  (11, 4, 'page_view', '/pricing', '2026-04-14 12:05:00'),
  (12, 1, 'page_view', '/account', '2026-04-15 13:00:00'),
  (13, 2, 'purchase', '/checkout', '2026-04-16 14:00:00'),
  (14, 3, 'click', '/features', '2026-04-17 15:00:00'),
  (15, 4, 'signup', '/register', '2026-04-18 16:00:00'),
  (1, 1, 'page_view', '/home', '2026-04-21 09:00:00'),
  (2, 1, 'click', '/products', '2026-04-21 09:05:00'),
  (3, 1, 'purchase', '/checkout', '2026-04-21 09:10:00'),
  (4, 2, 'page_view', '/home', '2026-04-22 10:00:00'),
  (5, 2, 'page_view', '/products', '2026-04-22 10:05:00'),
  (6, 2, 'click', '/products/123', '2026-04-22 10:10:00'),
  (7, 3, 'page_view', '/home', '2026-04-23 11:00:00'),
  (8, 3, 'signup', '/register', '2026-04-23 11:05:00'),
  (9, 3, 'page_view', '/dashboard', '2026-04-23 11:10:00');
