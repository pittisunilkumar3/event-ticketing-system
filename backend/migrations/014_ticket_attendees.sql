CREATE TABLE IF NOT EXISTS order_attendees (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 order_id INT UNSIGNED NOT NULL,
 ticket_type_id INT UNSIGNED NOT NULL,
 position INT UNSIGNED NOT NULL,
 name VARCHAR(150) NOT NULL,
 email VARCHAR(254) NULL,
 phone VARCHAR(40) NULL,
 form_json LONGTEXT NULL,
 answers_json LONGTEXT NULL,
 UNIQUE KEY uq_order_attendee_position (order_id,ticket_type_id,position),
 FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
 FOREIGN KEY (ticket_type_id) REFERENCES ticket_types(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS attendee_registration_files (
 attendee_id INT UNSIGNED NOT NULL,
 field_id VARCHAR(50) NOT NULL,
 file_name VARCHAR(180) NOT NULL,
 mime_type VARCHAR(80) NOT NULL,
 file_data MEDIUMBLOB NOT NULL,
 PRIMARY KEY (attendee_id,field_id),
 FOREIGN KEY (attendee_id) REFERENCES order_attendees(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS attendee_id INT UNSIGNED NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ticket_attendee ON tickets(attendee_id);
