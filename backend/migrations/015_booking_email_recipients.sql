ALTER TABLE mail_outbox
 ADD COLUMN IF NOT EXISTS recipient_key VARCHAR(64) NOT NULL DEFAULT 'booking',
 ADD COLUMN IF NOT EXISTS recipient_email VARCHAR(254) NULL,
 ADD COLUMN IF NOT EXISTS recipient_name VARCHAR(150) NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_order_recipient_notification ON mail_outbox(order_id,event_key,recipient_key);
ALTER TABLE mail_outbox DROP INDEX IF EXISTS uq_order_notification;
