-- Existing discounts stay per booking, with no coupon-specific tax exemption.
ALTER TABLE discount_coupons
 ADD COLUMN IF NOT EXISTS fixed_per_ticket BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN IF NOT EXISTS tax_free_unit_max_minor BIGINT UNSIGNED NULL;
