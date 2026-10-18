CREATE TABLE IF NOT EXISTS organizer_messages (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 event_id INT UNSIGNED NOT NULL,
 created_by INT UNSIGNED NOT NULL,
 request_key CHAR(36) NOT NULL,
 payload_hash CHAR(64) NOT NULL,
 subject VARCHAR(255) NOT NULL,
 body MEDIUMTEXT NOT NULL,
 paused BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_message_request(request_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS organizer_message_recipients (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 message_id INT UNSIGNED NOT NULL,
 email VARCHAR(254) NOT NULL,
 name VARCHAR(255) NOT NULL,
 subject VARCHAR(255) NOT NULL,
 html MEDIUMTEXT NOT NULL,
 status ENUM('pending','sending','sent','failed','skipped') NOT NULL DEFAULT 'pending',
 attempts INT NOT NULL DEFAULT 0,
 error_message VARCHAR(500) NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_message_email(message_id,email),
 INDEX idx_message_queue(status,id),
 FOREIGN KEY (message_id) REFERENCES organizer_messages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
