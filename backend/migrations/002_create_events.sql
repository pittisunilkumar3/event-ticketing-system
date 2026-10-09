-- Events
CREATE TABLE IF NOT EXISTS events (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  description TEXT NULL,
  category VARCHAR(80) NULL,
  venue VARCHAR(200) NULL,
  city VARCHAR(100) NULL,
  banner_image VARCHAR(255) NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NULL,
  status ENUM('draft', 'published', 'cancelled') NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_events_status (status),
  INDEX idx_events_start (start_datetime),
  INDEX idx_events_category (category),
  INDEX idx_events_city (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
