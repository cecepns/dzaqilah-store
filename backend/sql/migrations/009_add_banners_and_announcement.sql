-- Migration 009: Add banners table and announcement settings
USE raca_cell;

-- 1. Create banners table
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Insert announcement settings into settings table if not exists
INSERT INTO settings (setting_key, setting_value)
VALUES
  ('announcement_text', 'Selamat datang di Dzaqilah Cell! Layanan pulsa, paket data, & PPOB beroperasi 24 jam nonstop.'),
  ('announcement_active', '1')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- 3. Insert default promotional banners if table is empty
INSERT INTO banners (title, description, badge, image_url, action_url, show_text, is_active, sort_order)
SELECT 'QRIS Static Untuk Usahamu', 'MDR 0% & Pencairan Realtime', 'Fitur Unggulan', '/banners/promo_qris.jpg', '/request-topup', 1, 1, 1
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE image_url = '/banners/promo_qris.jpg');

INSERT INTO banners (title, description, badge, image_url, action_url, show_text, is_active, sort_order)
SELECT 'Pulsa & Paket Data Termurah', 'Semua Operator Kilat 24 Jam', 'Diskon Spesial', '/banners/promo_pulsa.jpg', '/layanan/pulsa', 1, 1, 2
WHERE NOT EXISTS (SELECT 1 FROM banners WHERE image_url = '/banners/promo_pulsa.jpg');
