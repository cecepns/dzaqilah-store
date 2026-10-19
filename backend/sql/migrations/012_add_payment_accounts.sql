-- Migration 012: Add payment_accounts table and topup bank details
-- Description: Mendukung opsi rekening transfer (BRI, BSI, DANA, GOPAY, OVO, dll) untuk topup saldo

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

-- Tambah informasi rekening ke topup_requests
ALTER TABLE topup_requests ADD COLUMN bank_name VARCHAR(50) NULL;
ALTER TABLE topup_requests ADD COLUMN account_number VARCHAR(100) NULL;
ALTER TABLE topup_requests ADD COLUMN account_name VARCHAR(100) NULL;

-- Default payment accounts
INSERT INTO payment_accounts (bank_name, account_number, account_name, type, display_order, is_active) VALUES
('BRI', '022501013585534', 'ABDUL RAHMAN', 'bank', 1, 1),
('BSI', '7349271995', 'ABDUL RAHMAN', 'bank', 2, 1),
('DANA', '085299636873', 'ABDUL RAHMAN', 'ewallet', 3, 1),
('GOPAY', '085299636873', 'ABDUL RAHMAN', 'ewallet', 4, 1),
('OVO', '085299636873', 'ABDUL RAHMAN', 'ewallet', 5, 1);
