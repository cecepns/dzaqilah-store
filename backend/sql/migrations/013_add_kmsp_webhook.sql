-- Migration 013: Add KMSP Webhook Configuration
-- Description: Menambahkan default webhook secret KMSP ke tabel settings
-- Date: 2026-10-21

USE raca_cell;

INSERT INTO settings (setting_key, setting_value)
VALUES ('kmsp_webhook_secret', '')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
