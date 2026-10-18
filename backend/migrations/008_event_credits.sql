ALTER TABLE events ADD COLUMN IF NOT EXISTS credit_consumed BOOLEAN NOT NULL DEFAULT FALSE;
-- Existing published events keep their publishing allowance; no retrospective charge.
UPDATE events SET credit_consumed=TRUE WHERE status='published';
