-- An append-only booking ledger. USD matches existing ticket/order pricing.
CREATE TABLE IF NOT EXISTS event_wallet_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  event_id INT UNSIGNED NOT NULL,
  order_id INT UNSIGNED NOT NULL,
  entry_type ENUM('booking','reversal') NOT NULL,
  reason ENUM('booking','opening','cancelled','refunded') NOT NULL,
  mode ENUM('demo','recorded') NOT NULL,
  currency CHAR(3) NOT NULL DEFAULT 'USD',
  amount DECIMAL(14,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_wallet_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wallet_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  UNIQUE KEY uq_wallet_order_entry (order_id,entry_type),
  INDEX idx_wallet_event_mode (event_id,mode,id),
  INDEX idx_wallet_mode (mode,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Opening credits only for currently paid orders: older closed orders have no
-- reliable payment transition history. Do not invent historical collections.
INSERT IGNORE INTO event_wallet_entries(event_id,order_id,entry_type,reason,mode,amount,created_at)
SELECT event_id,id,'booking','opening',IF(payment_method='mock','demo','recorded'),total_amount,created_at
FROM orders WHERE status='paid';
