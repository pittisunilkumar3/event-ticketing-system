CREATE TABLE IF NOT EXISTS organizations (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(120) NOT NULL, slug VARCHAR(60) NOT NULL UNIQUE,
 db_name VARCHAR(64) NOT NULL UNIQUE, owner_email VARCHAR(150) NOT NULL,
 status ENUM('provisioning','active','suspended','failed') NOT NULL DEFAULT 'provisioning',
 event_balance INT NOT NULL DEFAULT 0,
 is_legacy BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS platform_admins (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 name VARCHAR(100) NOT NULL, email VARCHAR(150) NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL, active BOOLEAN NOT NULL DEFAULT TRUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS event_packages (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL,
 event_count INT UNSIGNED NOT NULL, price_paise INT UNSIGNED NULL,
 active BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS package_purchases (
 id VARCHAR(36) PRIMARY KEY, organization_id INT UNSIGNED NOT NULL,
 package_id INT UNSIGNED NOT NULL, package_name VARCHAR(100) NOT NULL,
 event_count INT UNSIGNED NOT NULL, amount_paise INT UNSIGNED NOT NULL,
 currency CHAR(3) NOT NULL DEFAULT 'INR',
 status ENUM('pending','paid','failed','review') NOT NULL DEFAULT 'pending',
 provider_order_id VARCHAR(100) NULL UNIQUE, provider_payment_id VARCHAR(100) NULL UNIQUE,
 request_key VARCHAR(100) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, paid_at DATETIME NULL,
 UNIQUE KEY uq_purchase_request (organization_id, request_key),
 FOREIGN KEY (organization_id) REFERENCES organizations(id),
 FOREIGN KEY (package_id) REFERENCES event_packages(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS event_credits (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, organization_id INT UNSIGNED NOT NULL,
 amount INT NOT NULL, kind VARCHAR(30) NOT NULL, reason VARCHAR(500) NOT NULL,
 reference_key VARCHAR(120) NOT NULL, actor_id INT UNSIGNED NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 UNIQUE KEY uq_credit_reference (organization_id, reference_key),
 FOREIGN KEY (organization_id) REFERENCES organizations(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE IF NOT EXISTS platform_audit (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY, actor_id INT UNSIGNED NULL,
 organization_id INT UNSIGNED NULL, action VARCHAR(80) NOT NULL,
 details_json TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS platform_settings (
 name VARCHAR(80) PRIMARY KEY,
 value_json LONGTEXT NOT NULL,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Email lookup only. Passwords and roles remain authoritative in each tenant.
CREATE TABLE IF NOT EXISTS organizer_login_directory (
 organization_id INT UNSIGNED NOT NULL,
 admin_id INT UNSIGNED NOT NULL,
 email VARCHAR(150) NOT NULL,
 PRIMARY KEY (organization_id, admin_id),
 INDEX organizer_login_email (email)
);
