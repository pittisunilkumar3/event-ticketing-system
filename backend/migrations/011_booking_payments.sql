ALTER TABLE event_wallet_entries
 MODIFY order_id INT UNSIGNED NULL,
 MODIFY entry_type ENUM('booking','reversal','withdrawal') NOT NULL,
 MODIFY reason ENUM('booking','opening','cancelled','refunded','withdrawal') NOT NULL,
 MODIFY mode ENUM('demo','recorded','test','live') NOT NULL,
 ADD COLUMN withdrawal_id VARCHAR(36) NULL,
 ADD UNIQUE KEY uq_wallet_withdrawal (withdrawal_id);
CREATE TABLE IF NOT EXISTS booking_reserved_items (
 order_id INT UNSIGNED NOT NULL,
 ticket_type_id INT UNSIGNED NOT NULL,
 qty INT UNSIGNED NOT NULL,
 design_json LONGTEXT NOT NULL,
 PRIMARY KEY(order_id,ticket_type_id),
 FOREIGN KEY(order_id) REFERENCES orders(id),
 FOREIGN KEY(ticket_type_id) REFERENCES ticket_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
