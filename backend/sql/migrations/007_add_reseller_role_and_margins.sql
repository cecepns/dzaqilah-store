-- Migration 007: Reseller role and multi-tier pricing
-- Description: Menambahkan role reseller ke users, margin reseller global di settings, dan reseller_margin_percent di product_margins

ALTER TABLE users MODIFY COLUMN role ENUM('owner', 'admin', 'reseller', 'user') NOT NULL DEFAULT 'user';

ALTER TABLE product_margins ADD COLUMN reseller_margin_percent DECIMAL(5, 2) NULL DEFAULT NULL AFTER margin_percent;

INSERT INTO settings (setting_key, setting_value) VALUES ('margin_reseller_percent', '2')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
