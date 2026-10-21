-- Dzaqilah Store PPOB - Full Database Schema (latest)
-- Untuk fresh install, jalankan file ini ATAU gunakan migration berurutan:
--   sql/migrations/000_create_database.sql
--   sql/migrations/001_initial_schema.sql
--   sql/migrations/002_add_settings_table.sql
--
-- Untuk update database yang sudah ada, jalankan hanya migration baru di folder migrations/

CREATE DATABASE IF NOT EXISTS raca_cell CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE raca_cell;

-- ─── 001: Initial Schema ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  partner_name VARCHAR(100) NULL DEFAULT NULL,
  password VARCHAR(255) NOT NULL,
  role ENUM('owner', 'admin', 'reseller', 'user') NOT NULL DEFAULT 'user',
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
  status ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role (role),
  INDEX idx_users_status (status),
  INDEX idx_users_email (email)
);

CREATE TABLE IF NOT EXISTS balance_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type ENUM('topup', 'add', 'reduce', 'purchase', 'refund') NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  balance_before DECIMAL(15, 2) NOT NULL,
  balance_after DECIMAL(15, 2) NOT NULL,
  note TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_balance_user (user_id),
  INDEX idx_balance_type (type)
);

CREATE TABLE IF NOT EXISTS transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ref_id VARCHAR(100) NOT NULL UNIQUE,
  customer_no VARCHAR(30) NOT NULL,
  buyer_sku_code VARCHAR(50) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  brand VARCHAR(100),
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid',
  price DECIMAL(15, 2) NOT NULL,
  selling_price DECIMAL(15, 2) NOT NULL,
  status ENUM('success', 'pending', 'failed') NOT NULL DEFAULT 'pending',
  sn VARCHAR(255),
  message TEXT,
  digiflazz_response JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_transactions_user (user_id),
  INDEX idx_transactions_status (status),
  INDEX idx_transactions_ref (ref_id)
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  metadata JSON,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_logs_user (user_id),
  INDEX idx_logs_action (action),
  INDEX idx_logs_created (created_at)
);

-- ─── 002: Settings Table (Margin) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_by INT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_settings_key (setting_key)
);

INSERT INTO settings (setting_key, setting_value) VALUES ('margin_percent', '5')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('margin_reseller_percent', '2')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('admin_whatsapp', '')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('digiflazz_username', 'tovowaWjYdvD')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('digiflazz_api_key', '86a9458b-3f32-58f1-85e5-eaf901bfb7ed')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('digiflazz_testing', 'true')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('digiflazz_webhook_secret', 'dzaqilahstore2026')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('kmsp_api_key', 'fe5df3e7-e7a8-4e63-8006-374b530024cb')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('kmsp_base_url', 'https://my.kmsp-store.com')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('kmsp_enable_member', 'false')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value) VALUES ('kmsp_enable_reseller', 'false')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- ─── 006: Product Margins (Per-Item Override) ─────────────────────────────

CREATE TABLE IF NOT EXISTS product_margins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  buyer_sku_code VARCHAR(100) NOT NULL UNIQUE,
  product_name VARCHAR(200) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid',
  margin_percent DECIMAL(5, 2) NOT NULL,
  reseller_margin_percent DECIMAL(5, 2) NULL DEFAULT NULL,
  updated_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_product_margins_sku (buyer_sku_code),
  INDEX idx_product_margins_type (transaction_type)
);

-- ─── 003: Topup Requests ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topup_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  note TEXT,
  proof_image VARCHAR(255) NULL,
  bank_name VARCHAR(50) NULL,
  account_number VARCHAR(100) NULL,
  account_name VARCHAR(100) NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  admin_note TEXT,
  processed_by INT,
  processed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_topup_user (user_id),
  INDEX idx_topup_status (status)
);

-- ─── 004: Pascabayar Support ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pasca_inquiries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  ref_id VARCHAR(100) NOT NULL UNIQUE,
  buyer_sku_code VARCHAR(50) NOT NULL,
  customer_no VARCHAR(30) NOT NULL,
  product_name VARCHAR(200) NOT NULL,
  category VARCHAR(100),
  brand VARCHAR(100),
  base_price DECIMAL(15, 2) NOT NULL,
  selling_price DECIMAL(15, 2) NOT NULL,
  customer_name VARCHAR(200),
  inquiry_response JSON,
  paid_at TIMESTAMP NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_pasca_inquiry_user (user_id),
  INDEX idx_pasca_inquiry_expires (expires_at)
);

-- ─── 005: Banner & Papan Pengumuman Support ─────────────────────────────────

CREATE TABLE IF NOT EXISTS banners (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NULL,
  description TEXT NULL,
  badge VARCHAR(100) NULL,
  image_url VARCHAR(500) NOT NULL,
  action_url VARCHAR(500) NULL,
  show_text BOOLEAN NOT NULL DEFAULT TRUE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_banners_active (is_active, sort_order)
);

-- ─── 006: Rekening / Payment Accounts Support ──────────────────────────────
CREATE TABLE IF NOT EXISTS payment_accounts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  bank_name VARCHAR(50) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_name VARCHAR(100) NOT NULL,
  type ENUM('bank', 'ewallet', 'qris') NOT NULL DEFAULT 'bank',
  qr_image VARCHAR(500) NULL,
  instructions VARCHAR(255) NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INT NOT NULL DEFAULT 0,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_payment_accounts_active (is_active, display_order)
);

INSERT INTO payment_accounts (bank_name, account_number, account_name, type, display_order, is_active) VALUES
('BRI', '022501013585534', 'ABDUL RAHMAN', 'bank', 1, 1),
('BSI', '7349271995', 'ABDUL RAHMAN', 'bank', 2, 1),
('DANA', '085299636873', 'ABDUL RAHMAN', 'ewallet', 3, 1),
('GOPAY', '085299636873', 'ABDUL RAHMAN', 'ewallet', 4, 1),
('OVO', '085299636873', 'ABDUL RAHMAN', 'ewallet', 5, 1);

-- Default owner dibuat otomatis saat server pertama kali dijalankan
-- Email: owner@racacell.com | Password: password123

