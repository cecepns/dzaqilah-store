-- ─── 012: Allow KMSP in transactions table ──────────────────────────────
ALTER TABLE transactions MODIFY COLUMN transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid';
