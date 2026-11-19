-- Offer pricing and per-pass Udyam discount for workspaces provisioned before those features.
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS offer_price DECIMAL(10,2) NULL AFTER price;
ALTER TABLE ticket_types ADD COLUMN IF NOT EXISTS udyam_discount_minor BIGINT(20) UNSIGNED NULL AFTER quantity;
