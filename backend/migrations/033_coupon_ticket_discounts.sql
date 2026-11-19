-- Optional ticket-type ID -> per-ticket discount in paise for fixed-per-ticket coupons.
-- Unlisted eligible passes continue to use the coupon's value_units.
ALTER TABLE discount_coupons
 ADD COLUMN IF NOT EXISTS fixed_ticket_discounts_minor JSON NULL;
