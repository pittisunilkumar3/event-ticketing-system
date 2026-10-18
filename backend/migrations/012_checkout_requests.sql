ALTER TABLE orders ADD COLUMN checkout_request_hash CHAR(64) NULL, ADD UNIQUE KEY uq_order_checkout (checkout_request_hash);
