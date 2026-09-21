-- Migration: Add Returns and Damages Tracking
-- Run this in Supabase SQL Editor to update existing database

-- Add return_reason column
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS return_reason TEXT;

-- Add damage_type column  
ALTER TABLE inventory_logs ADD COLUMN IF NOT EXISTS damage_type TEXT;

-- Update type CHECK constraint to include RETURN and DAMAGE
-- First, drop the existing constraint
ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_type_check;

-- Add the updated constraint with new types
ALTER TABLE inventory_logs ADD CONSTRAINT inventory_logs_type_check 
    CHECK (type IN ('INBOUND_QC', 'OUTBOUND_PACKING', 'RETURN', 'DAMAGE'));

-- Create index for return_reason for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_logs_return_reason ON inventory_logs(return_reason);

-- Create index for damage_type for better query performance
CREATE INDEX IF NOT EXISTS idx_inventory_logs_damage_type ON inventory_logs(damage_type);
