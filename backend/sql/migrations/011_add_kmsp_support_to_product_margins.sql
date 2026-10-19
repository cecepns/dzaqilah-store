-- Migration 011: Add KMSP / DZ Store support to product_margins
-- Description: Mendukung pengaturan margin per produk untuk paket akrab KMSP / DZ STORE

ALTER TABLE product_margins MODIFY COLUMN buyer_sku_code VARCHAR(100) NOT NULL;
ALTER TABLE product_margins MODIFY COLUMN transaction_type VARCHAR(20) NOT NULL DEFAULT 'prepaid';
