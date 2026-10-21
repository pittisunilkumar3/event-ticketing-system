ALTER TABLE orders ADD COLUMN archived_at DATETIME NULL, ADD INDEX idx_orders_archived (archived_at,id);
