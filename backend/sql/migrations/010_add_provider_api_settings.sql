-- Migration 010: Add Provider API Settings (Digiflazz & KMSP Store)
-- Description: Menambahkan konfigurasi provider API (Digiflazz dan KMSP) ke tabel settings dan memperluas kapasitas setting_value
-- Date: 2026-10-19

USE raca_cell;

-- 1. Perluas tipe data setting_value agar dapat menampung secret key, token, dan URL panjang tanpa terpotong
ALTER TABLE settings MODIFY COLUMN setting_value TEXT NOT NULL;

-- 2. Konfigurasi Default Digiflazz
INSERT INTO settings (setting_key, setting_value)
VALUES ('digiflazz_username', 'tovowaWjYdvD')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value)
VALUES ('digiflazz_api_key', '86a9458b-3f32-58f1-85e5-eaf901bfb7ed')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value)
VALUES ('digiflazz_testing', 'true')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value)
VALUES ('digiflazz_webhook_secret', 'dzaqilahstore2026')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

-- 3. Konfigurasi Default KMSP Store (AKMT & Tembak Paket)
INSERT INTO settings (setting_key, setting_value)
VALUES ('kmsp_api_key', 'fe5df3e7-e7a8-4e63-8006-374b530024cb')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value)
VALUES ('kmsp_base_url', 'https://my.kmsp-store.com')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value)
VALUES ('kmsp_enable_member', 'false')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO settings (setting_key, setting_value)
VALUES ('kmsp_enable_reseller', 'false')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
