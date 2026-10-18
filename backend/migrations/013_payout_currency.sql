-- Preserve the currency of historical orders. New bookings are explicitly INR.
ALTER TABLE orders ADD COLUMN currency CHAR(3) NOT NULL DEFAULT 'USD';
ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE event_wallet_entries
 MODIFY entry_type ENUM('booking','reversal','withdrawal','payout_reversal') NOT NULL,
 MODIFY reason ENUM('booking','opening','cancelled','refunded','withdrawal','payout_reversal') NOT NULL,
 DROP INDEX uq_wallet_withdrawal,
 ADD UNIQUE KEY uq_wallet_withdrawal (withdrawal_id,entry_type);
