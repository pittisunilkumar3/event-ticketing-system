-- One registration number per event, retained across booking status changes.
CREATE TABLE IF NOT EXISTS event_udyam_registrations (
 event_id INT UNSIGNED NOT NULL,
 udyam_number VARCHAR(19) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 order_id INT UNSIGNED NOT NULL,
 ticket_type_id INT UNSIGNED NOT NULL,
 attendee_position INT UNSIGNED NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (event_id,udyam_number),
 UNIQUE KEY uq_udyam_attendee (order_id,ticket_type_id,attendee_position),
 CONSTRAINT ck_udyam_number CHECK (BINARY udyam_number = BINARY UPPER(TRIM(udyam_number)) AND udyam_number REGEXP '^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$'),
 FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE RESTRICT,
 FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT,
 FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
