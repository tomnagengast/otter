-- Source data for postgres loader demo
-- This data gets loaded into postgres.analytics via otter load

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER REFERENCES customers(id),
  amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO customers (id, name, email, created_at) VALUES
  (1, 'Alice', 'alice@example.com', '2024-01-15 10:00:00Z'),
  (2, 'Bob', 'bob@example.com', '2024-01-16 11:00:00Z'),
  (3, 'Charlie', 'charlie@example.com', '2024-01-17 12:00:00Z'),
  (4, 'Diana', 'diana@example.com', '2024-01-18 13:00:00Z');

INSERT INTO orders (id, customer_id, amount, status, created_at) VALUES
  (101, 1, 100.00, 'completed', '2024-02-01 09:00:00Z'),
  (102, 1, 50.00, 'completed', '2024-02-05 10:00:00Z'),
  (103, 2, 200.00, 'completed', '2024-02-10 11:00:00Z'),
  (104, 2, 75.00, 'pending', '2024-02-15 12:00:00Z'),
  (105, 2, 125.00, 'completed', '2024-02-20 13:00:00Z'),
  (106, 3, 300.00, 'completed', '2024-02-25 14:00:00Z'),
  (107, 4, 50.00, 'cancelled', '2024-03-01 15:00:00Z');

-- Reset sequences to avoid conflicts
SELECT setval('customers_id_seq', (SELECT MAX(id) FROM customers));
SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders));
