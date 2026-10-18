CREATE TABLE IF NOT EXISTS wallet_payouts (
 withdrawal_id VARCHAR(36) PRIMARY KEY,
 provider_id VARCHAR(80) NULL UNIQUE,
 contact_id VARCHAR(80) NULL,
 fund_account_id VARCHAR(80) NULL,
 config_encrypted LONGTEXT NOT NULL,
 amount_minor BIGINT UNSIGNED NOT NULL,
 currency CHAR(3) NOT NULL,
 status VARCHAR(30) NOT NULL DEFAULT 'ready',
 last_error VARCHAR(300) NULL,
 utr VARCHAR(150) NULL,
 checked_at DATETIME NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (withdrawal_id) REFERENCES wallet_withdrawals(id),
 INDEX idx_payout_poll (status,checked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
