-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create products table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sku TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    size TEXT NOT NULL,
    stock INTEGER DEFAULT 0 CHECK (stock >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create inventory_logs table for audit trail
CREATE TABLE IF NOT EXISTS inventory_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('INBOUND_QC', 'OUTBOUND_PACKING')),
    qty INTEGER NOT NULL CHECK (qty != 0),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON inventory_logs(type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at);

-- Create a function to update product stock and log the transaction
CREATE OR REPLACE FUNCTION update_stock_with_log(
    p_sku TEXT,
    p_qty INTEGER,
    p_type TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_product_id UUID;
    v_current_stock INTEGER;
BEGIN
    -- Get product ID and current stock
    SELECT id, stock INTO v_product_id, v_current_stock
    FROM products
    WHERE sku = p_sku;
    
    -- Check if product exists
    IF v_product_id IS NULL THEN
        RAISE EXCEPTION 'Product with SKU % not found', p_sku;
    END IF;
    
    -- Check if sufficient stock for outbound
    IF p_type = 'OUTBOUND_PACKING' AND v_current_stock + p_qty < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for SKU %', p_sku;
    END IF;
    
    -- Update product stock
    UPDATE products
    SET stock = stock + p_qty
    WHERE id = v_product_id;
    
    -- Insert inventory log
    INSERT INTO inventory_logs (product_id, type, qty, notes)
    VALUES (v_product_id, p_type, p_qty, p_notes);
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Create atomic RPC function for safe stock deduction (prevents race conditions)
CREATE OR REPLACE FUNCTION deduct_product_stock(p_sku TEXT, p_qty INT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_product_id UUID;
    v_current_stock INT;
    v_result JSONB;
BEGIN
    -- Lock row data to prevent concurrent request conflicts
    SELECT id, stock INTO v_product_id, v_current_stock 
    FROM products 
    WHERE sku = p_sku 
    FOR UPDATE;

    IF v_product_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'SKU tidak ditemukan');
    END IF;

    IF v_current_stock < p_qty THEN
        RETURN jsonb_build_object('success', false, 'message', 'Stok tidak mencukupi', 'current_stock', v_current_stock);
    END IF;

    -- Deduct product stock
    UPDATE products
    SET stock = stock - p_qty
    WHERE id = v_product_id;

    -- Insert log to inventory_logs
    INSERT INTO inventory_logs (product_id, type, qty, notes)
    VALUES (v_product_id, 'OUTBOUND_PACKING', -p_qty, 'Outbound scan via Packing App');

    RETURN jsonb_build_object('success', true, 'message', 'Stok berhasil dikurangi', 'remaining_stock', v_current_stock - p_qty);
END;
$$;

-- Insert sample data for testing
INSERT INTO products (sku, name, color, size, stock) VALUES
    ('AURELIA-BLK-L', 'Aurelia Ruffle Dress', 'Black', 'L', 50),
    ('AURELIA-BLK-M', 'Aurelia Ruffle Dress', 'Black', 'M', 30),
    ('AURELIA-WHT-L', 'Aurelia Ruffle Dress', 'White', 'L', 25),
    ('CELESTIA-RED-M', 'Celestia Blouse', 'Red', 'M', 15),
    ('CELESTIA-RED-S', 'Celestia Blouse', 'Red', 'S', 8)
ON CONFLICT (sku) DO NOTHING;

-- Insert sample inventory logs (only for products with stock > 0)
INSERT INTO inventory_logs (product_id, type, qty, notes)
SELECT 
    id, 
    'INBOUND_QC', 
    stock, 
    'Initial stock from QC'
FROM products
WHERE stock > 0
ON CONFLICT DO NOTHING;