-- Migration: Add MANUAL_ADJUSTMENT type to inventory_logs type constraint
-- This fixes the issue where admin cannot edit products with adjustment reasons

-- Drop the existing type constraint
ALTER TABLE inventory_logs DROP CONSTRAINT IF EXISTS inventory_logs_type_check;

-- Re-add the constraint with MANUAL_ADJUSTMENT included
ALTER TABLE inventory_logs ADD CONSTRAINT inventory_logs_type_check 
    CHECK (type IN ('INBOUND_QC', 'OUTBOUND_PACKING', 'RETURN', 'DAMAGE', 'MANUAL_ADJUSTMENT'));
