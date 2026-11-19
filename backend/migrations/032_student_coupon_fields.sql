-- Opt-in student pricing on coupons: attendees of discounted passes must give
-- their college and a student ID that is unique across the event. Registrations
-- are retained across booking status changes, like Udyam registrations.
ALTER TABLE discount_coupons ADD COLUMN IF NOT EXISTS require_student_fields BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS event_student_registrations (
 event_id INT UNSIGNED NOT NULL,
 student_id VARCHAR(40) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 order_id INT UNSIGNED NOT NULL,
 ticket_type_id INT UNSIGNED NOT NULL,
 attendee_position INT UNSIGNED NOT NULL,
 college_name VARCHAR(150) NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (event_id,student_id),
 UNIQUE KEY uq_student_attendee (order_id,ticket_type_id,attendee_position),
 FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
 FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
 FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
