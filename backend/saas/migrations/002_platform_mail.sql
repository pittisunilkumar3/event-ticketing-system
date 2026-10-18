CREATE TABLE IF NOT EXISTS platform_email_templates (
 event_key VARCHAR(60) PRIMARY KEY,
 name VARCHAR(120) NOT NULL,
 active BOOLEAN NOT NULL DEFAULT TRUE,
 config_json LONGTEXT NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS platform_mail_outbox (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 organization_id INT UNSIGNED NOT NULL,
 event_key VARCHAR(60) NOT NULL,
 recipient VARCHAR(254) NOT NULL DEFAULT '',
 data_json LONGTEXT NOT NULL,
 reference_key VARCHAR(120) NOT NULL,
 status ENUM('pending','sending','sent','failed','skipped') NOT NULL,
 attempts INT UNSIGNED NOT NULL DEFAULT 0,
 message_id VARCHAR(255) NULL,
 error_message VARCHAR(500) NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_platform_message (event_key,reference_key),
 KEY idx_platform_mail_status (status,id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
