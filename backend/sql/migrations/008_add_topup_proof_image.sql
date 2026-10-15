-- Migration 008: Add proof_image to topup_requests
ALTER TABLE topup_requests
  ADD COLUMN proof_image VARCHAR(255) NULL AFTER note;
