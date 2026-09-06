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

-- Create print_history table to track label prints
CREATE TABLE IF NOT EXISTS print_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_product_id ON inventory_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_type ON inventory_logs(type);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at ON inventory_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_print_history_product_id ON print_history(product_id);
CREATE INDEX IF NOT EXISTS idx_print_history_created_at ON print_history(created_at);

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
    ('RCL-BLK-L', 'Rocela', 'Hitam', 'L', 50),
    ('RCL-BLK-2XL', 'Rocela', 'Hitam', '2XL', 30),
    ('RCL-BLK-3XL', 'Rocela', 'Hitam', '3XL', 25),
    ('RCL-NVY-L', 'Rocela', 'Navy', 'L', 40),
    ('RCL-NVY-2XL', 'Rocela', 'Navy', '2XL', 35),
    ('RCL-NVY-3XL', 'Rocela', 'Navy', '3XL', 20),
    ('RCL-DST-L', 'Rocela', 'Dusty', 'L', 45),
    ('RCL-DST-2XL', 'Rocela', 'Dusty', '2XL', 30),
    ('RCL-DST-3XL', 'Rocela', 'Dusty', '3XL', 25),
    ('RCL-MRN-L', 'Rocela', 'Maroon', 'L', 35),
    ('RCL-MRN-2XL', 'Rocela', 'Maroon', '2XL', 30),
    ('RCL-MRN-3XL', 'Rocela', 'Maroon', '3XL', 20),
    ('RCL-LLC-L', 'Rocela', 'Lilac', 'L', 40),
    ('RCL-LLC-2XL', 'Rocela', 'Lilac', '2XL', 30),
    ('RCL-LLC-3XL', 'Rocela', 'Lilac', '3XL', 25),
    ('RCL-SLV-L', 'Rocela', 'Silver', 'L', 35),
    ('RCL-SLV-2XL', 'Rocela', 'Silver', '2XL', 30),
    ('RCL-SLV-3XL', 'Rocela', 'Silver', '3XL', 20),
    ('RCL-GRY-L', 'Rocela', 'Grey', 'L', 40),
    ('RCL-GRY-2XL', 'Rocela', 'Grey', '2XL', 30),
    ('RCL-GRY-3XL', 'Rocela', 'Grey', '3XL', 25),
    ('LNA-BLK-L', 'Lina', 'Hitam', 'L', 50),
    ('LNA-BLK-XL', 'Lina', 'Hitam', 'XL', 40),
    ('LNA-BLK-2XL', 'Lina', 'Hitam', '2XL', 30),
    ('LNA-BLK-3XL', 'Lina', 'Hitam', '3XL', 25),
    ('LNA-NVY-L', 'Lina', 'Navy', 'L', 45),
    ('LNA-NVY-XL', 'Lina', 'Navy', 'XL', 35),
    ('LNA-NVY-2XL', 'Lina', 'Navy', '2XL', 30),
    ('LNA-NVY-3XL', 'Lina', 'Navy', '3XL', 20),
    ('LNA-DST-L', 'Lina', 'Dusty', 'L', 40),
    ('LNA-DST-XL', 'Lina', 'Dusty', 'XL', 35),
    ('LNA-DST-2XL', 'Lina', 'Dusty', '2XL', 30),
    ('LNA-DST-3XL', 'Lina', 'Dusty', '3XL', 25),
    ('LNA-MRN-L', 'Lina', 'Maroon', 'L', 35),
    ('LNA-MRN-XL', 'Lina', 'Maroon', 'XL', 30),
    ('LNA-MRN-2XL', 'Lina', 'Maroon', '2XL', 25),
    ('LNA-MRN-3XL', 'Lina', 'Maroon', '3XL', 20),
    ('LNA-LLC-L', 'Lina', 'Lilac', 'L', 40),
    ('LNA-LLC-XL', 'Lina', 'Lilac', 'XL', 35),
    ('LNA-LLC-2XL', 'Lina', 'Lilac', '2XL', 30),
    ('LNA-LLC-3XL', 'Lina', 'Lilac', '3XL', 25),
    ('LNA-SLV-L', 'Lina', 'Silver', 'L', 35),
    ('LNA-SLV-XL', 'Lina', 'Silver', 'XL', 30),
    ('LNA-SLV-2XL', 'Lina', 'Silver', '2XL', 25),
    ('LNA-SLV-3XL', 'Lina', 'Silver', '3XL', 20),
    ('LNA-GRY-L', 'Lina', 'Grey', 'L', 40),
    ('LNA-GRY-XL', 'Lina', 'Grey', 'XL', 35),
    ('LNA-GRY-2XL', 'Lina', 'Grey', '2XL', 30),
    ('LNA-GRY-3XL', 'Lina', 'Grey', '3XL', 25),
    ('LR3-BLK-L', 'Legging Rok 3/4', 'Hitam', 'L', 50),
    ('LR3-BLK-XL', 'Legging Rok 3/4', 'Hitam', 'XL', 40),
    ('LR3-BLK-2XL', 'Legging Rok 3/4', 'Hitam', '2XL', 30),
    ('LR3-BLK-3XL', 'Legging Rok 3/4', 'Hitam', '3XL', 25),
    ('LR3-NVY-L', 'Legging Rok 3/4', 'Navy', 'L', 45),
    ('LR3-NVY-XL', 'Legging Rok 3/4', 'Navy', 'XL', 35),
    ('LR3-NVY-2XL', 'Legging Rok 3/4', 'Navy', '2XL', 30),
    ('LR3-NVY-3XL', 'Legging Rok 3/4', 'Navy', '3XL', 20),
    ('LR3-DST-L', 'Legging Rok 3/4', 'Dusty', 'L', 40),
    ('LR3-DST-XL', 'Legging Rok 3/4', 'Dusty', 'XL', 35),
    ('LR3-DST-2XL', 'Legging Rok 3/4', 'Dusty', '2XL', 30),
    ('LR3-DST-3XL', 'Legging Rok 3/4', 'Dusty', '3XL', 25),
    ('LR3-MRN-L', 'Legging Rok 3/4', 'Maroon', 'L', 35),
    ('LR3-MRN-XL', 'Legging Rok 3/4', 'Maroon', 'XL', 30),
    ('LR3-MRN-2XL', 'Legging Rok 3/4', 'Maroon', '2XL', 25),
    ('LR3-MRN-3XL', 'Legging Rok 3/4', 'Maroon', '3XL', 20),
    ('LR3-LLC-L', 'Legging Rok 3/4', 'Lilac', 'L', 40),
    ('LR3-LLC-XL', 'Legging Rok 3/4', 'Lilac', 'XL', 35),
    ('LR3-LLC-2XL', 'Legging Rok 3/4', 'Lilac', '2XL', 30),
    ('LR3-LLC-3XL', 'Legging Rok 3/4', 'Lilac', '3XL', 25),
    ('LR3-SLV-L', 'Legging Rok 3/4', 'Silver', 'L', 35),
    ('LR3-SLV-XL', 'Legging Rok 3/4', 'Silver', 'XL', 30),
    ('LR3-SLV-2XL', 'Legging Rok 3/4', 'Silver', '2XL', 25),
    ('LR3-SLV-3XL', 'Legging Rok 3/4', 'Silver', '3XL', 20),
    ('LR3-GRY-L', 'Legging Rok 3/4', 'Grey', 'L', 40),
    ('LR3-GRY-XL', 'Legging Rok 3/4', 'Grey', 'XL', 35),
    ('LR3-GRY-2XL', 'Legging Rok 3/4', 'Grey', '2XL', 30),
    ('LR3-GRY-3XL', 'Legging Rok 3/4', 'Grey', '3XL', 25),
    ('SRW-BLK-L', 'Sirwal', 'Hitam', 'L', 50),
    ('SRW-BLK-XL', 'Sirwal', 'Hitam', 'XL', 40),
    ('SRW-BLK-2XL', 'Sirwal', 'Hitam', '2XL', 30),
    ('SRW-BLK-3XL', 'Sirwal', 'Hitam', '3XL', 25),
    ('SRW-NVY-L', 'Sirwal', 'Navy', 'L', 45),
    ('SRW-NVY-XL', 'Sirwal', 'Navy', 'XL', 35),
    ('SRW-NVY-2XL', 'Sirwal', 'Navy', '2XL', 30),
    ('SRW-NVY-3XL', 'Sirwal', 'Navy', '3XL', 20),
    ('SRW-DST-L', 'Sirwal', 'Dusty', 'L', 40),
    ('SRW-DST-XL', 'Sirwal', 'Dusty', 'XL', 35),
    ('SRW-DST-2XL', 'Sirwal', 'Dusty', '2XL', 30),
    ('SRW-DST-3XL', 'Sirwal', 'Dusty', '3XL', 25),
    ('SRW-MRN-L', 'Sirwal', 'Maroon', 'L', 35),
    ('SRW-MRN-XL', 'Sirwal', 'Maroon', 'XL', 30),
    ('SRW-MRN-2XL', 'Sirwal', 'Maroon', '2XL', 25),
    ('SRW-MRN-3XL', 'Sirwal', 'Maroon', '3XL', 20),
    ('SRW-LLC-L', 'Sirwal', 'Lilac', 'L', 40),
    ('SRW-LLC-XL', 'Sirwal', 'Lilac', 'XL', 35),
    ('SRW-LLC-2XL', 'Sirwal', 'Lilac', '2XL', 30),
    ('SRW-LLC-3XL', 'Sirwal', 'Lilac', '3XL', 25),
    ('SRW-SLV-L', 'Sirwal', 'Silver', 'L', 35),
    ('SRW-SLV-XL', 'Sirwal', 'Silver', 'XL', 30),
    ('SRW-SLV-2XL', 'Sirwal', 'Silver', '2XL', 25),
    ('SRW-SLV-3XL', 'Sirwal', 'Silver', '3XL', 20),
    ('SRW-GRY-L', 'Sirwal', 'Grey', 'L', 40),
    ('SRW-GRY-XL', 'Sirwal', 'Grey', 'XL', 35),
    ('SRW-GRY-2XL', 'Sirwal', 'Grey', '2XL', 30),
    ('SRW-GRY-3XL', 'Sirwal', 'Grey', '3XL', 25),
    ('HRM-BLK-L', 'Harem', 'Hitam', 'L', 50),
    ('HRM-BLK-XL', 'Harem', 'Hitam', 'XL', 40),
    ('HRM-BLK-2XL', 'Harem', 'Hitam', '2XL', 30),
    ('HRM-BLK-3XL', 'Harem', 'Hitam', '3XL', 25),
    ('HRM-NVY-L', 'Harem', 'Navy', 'L', 45),
    ('HRM-NVY-XL', 'Harem', 'Navy', 'XL', 35),
    ('HRM-NVY-2XL', 'Harem', 'Navy', '2XL', 30),
    ('HRM-NVY-3XL', 'Harem', 'Navy', '3XL', 20),
    ('HRM-DST-L', 'Harem', 'Dusty', 'L', 40),
    ('HRM-DST-XL', 'Harem', 'Dusty', 'XL', 35),
    ('HRM-DST-2XL', 'Harem', 'Dusty', '2XL', 30),
    ('HRM-DST-3XL', 'Harem', 'Dusty', '3XL', 25),
    ('HRM-MRN-L', 'Harem', 'Maroon', 'L', 35),
    ('HRM-MRN-XL', 'Harem', 'Maroon', 'XL', 30),
    ('HRM-MRN-2XL', 'Harem', 'Maroon', '2XL', 25),
    ('HRM-MRN-3XL', 'Harem', 'Maroon', '3XL', 20),
    ('HRM-LLC-L', 'Harem', 'Lilac', 'L', 40),
    ('HRM-LLC-XL', 'Harem', 'Lilac', 'XL', 35),
    ('HRM-LLC-2XL', 'Harem', 'Lilac', '2XL', 30),
    ('HRM-LLC-3XL', 'Harem', 'Lilac', '3XL', 25),
    ('HRM-SLV-L', 'Harem', 'Silver', 'L', 35),
    ('HRM-SLV-XL', 'Harem', 'Silver', 'XL', 30),
    ('HRM-SLV-2XL', 'Harem', 'Silver', '2XL', 25),
    ('HRM-SLV-3XL', 'Harem', 'Silver', '3XL', 20),
    ('HRM-GRY-L', 'Harem', 'Grey', 'L', 40),
    ('HRM-GRY-XL', 'Harem', 'Grey', 'XL', 35),
    ('HRM-GRY-2XL', 'Harem', 'Grey', '2XL', 30),
    ('HRM-GRY-3XL', 'Harem', 'Grey', '3XL', 25),
    ('ASM-BLK-L', 'Asimetri', 'Hitam', 'L', 50),
    ('ASM-BLK-XL', 'Asimetri', 'Hitam', 'XL', 40),
    ('ASM-BLK-2XL', 'Asimetri', 'Hitam', '2XL', 30),
    ('ASM-BLK-3XL', 'Asimetri', 'Hitam', '3XL', 25),
    ('ASM-NVY-L', 'Asimetri', 'Navy', 'L', 45),
    ('ASM-NVY-XL', 'Asimetri', 'Navy', 'XL', 35),
    ('ASM-NVY-2XL', 'Asimetri', 'Navy', '2XL', 30),
    ('ASM-NVY-3XL', 'Asimetri', 'Navy', '3XL', 20),
    ('ASM-DST-L', 'Asimetri', 'Dusty', 'L', 40),
    ('ASM-DST-XL', 'Asimetri', 'Dusty', 'XL', 35),
    ('ASM-DST-2XL', 'Asimetri', 'Dusty', '2XL', 30),
    ('ASM-DST-3XL', 'Asimetri', 'Dusty', '3XL', 25),
    ('ASM-MRN-L', 'Asimetri', 'Maroon', 'L', 35),
    ('ASM-MRN-XL', 'Asimetri', 'Maroon', 'XL', 30),
    ('ASM-MRN-2XL', 'Asimetri', 'Maroon', '2XL', 25),
    ('ASM-MRN-3XL', 'Asimetri', 'Maroon', '3XL', 20),
    ('ASM-LLC-L', 'Asimetri', 'Lilac', 'L', 40),
    ('ASM-LLC-XL', 'Asimetri', 'Lilac', 'XL', 35),
    ('ASM-LLC-2XL', 'Asimetri', 'Lilac', '2XL', 30),
    ('ASM-LLC-3XL', 'Asimetri', 'Lilac', '3XL', 25),
    ('ASM-SLV-L', 'Asimetri', 'Silver', 'L', 35),
    ('ASM-SLV-XL', 'Asimetri', 'Silver', 'XL', 30),
    ('ASM-SLV-2XL', 'Asimetri', 'Silver', '2XL', 25),
    ('ASM-SLV-3XL', 'Asimetri', 'Silver', '3XL', 20),
    ('ASM-GRY-L', 'Asimetri', 'Grey', 'L', 40),
    ('ASM-GRY-XL', 'Asimetri', 'Grey', 'XL', 35),
    ('ASM-GRY-2XL', 'Asimetri', 'Grey', '2XL', 30),
    ('ASM-GRY-3XL', 'Asimetri', 'Grey', '3XL', 25),
    ('JBM-BLK-ALL', 'Jilbab Malay', 'Hitam', 'All Size', 100),
    ('JBM-NVY-ALL', 'Jilbab Malay', 'Navy', 'All Size', 90),
    ('JBM-DST-ALL', 'Jilbab Malay', 'Dusty', 'All Size', 80),
    ('JBM-MRN-ALL', 'Jilbab Malay', 'Maroon', 'All Size', 70),
    ('JBM-LLC-ALL', 'Jilbab Malay', 'Lilac', 'All Size', 60),
    ('JBM-SLV-ALL', 'Jilbab Malay', 'Silver', 'All Size', 50),
    ('JBM-GRY-ALL', 'Jilbab Malay', 'Grey', 'All Size', 40),
    ('LRP-BLK-L', 'Legging Rok Panjang', 'Hitam', 'L', 50),
    ('LRP-BLK-XL', 'Legging Rok Panjang', 'Hitam', 'XL', 40),
    ('LRP-BLK-2XL', 'Legging Rok Panjang', 'Hitam', '2XL', 30),
    ('LRP-BLK-3XL', 'Legging Rok Panjang', 'Hitam', '3XL', 25),
    ('LRP-NVY-L', 'Legging Rok Panjang', 'Navy', 'L', 45),
    ('LRP-NVY-XL', 'Legging Rok Panjang', 'Navy', 'XL', 35),
    ('LRP-NVY-2XL', 'Legging Rok Panjang', 'Navy', '2XL', 30),
    ('LRP-NVY-3XL', 'Legging Rok Panjang', 'Navy', '3XL', 20),
    ('LRP-DST-L', 'Legging Rok Panjang', 'Dusty', 'L', 40),
    ('LRP-DST-XL', 'Legging Rok Panjang', 'Dusty', 'XL', 35),
    ('LRP-DST-2XL', 'Legging Rok Panjang', 'Dusty', '2XL', 30),
    ('LRP-DST-3XL', 'Legging Rok Panjang', 'Dusty', '3XL', 25),
    ('LRP-MRN-L', 'Legging Rok Panjang', 'Maroon', 'L', 35),
    ('LRP-MRN-XL', 'Legging Rok Panjang', 'Maroon', 'XL', 30),
    ('LRP-MRN-2XL', 'Legging Rok Panjang', 'Maroon', '2XL', 25),
    ('LRP-MRN-3XL', 'Legging Rok Panjang', 'Maroon', '3XL', 20),
    ('LRP-LLC-L', 'Legging Rok Panjang', 'Lilac', 'L', 40),
    ('LRP-LLC-XL', 'Legging Rok Panjang', 'Lilac', 'XL', 35),
    ('LRP-LLC-2XL', 'Legging Rok Panjang', 'Lilac', '2XL', 30),
    ('LRP-LLC-3XL', 'Legging Rok Panjang', 'Lilac', '3XL', 25),
    ('LRP-SLV-L', 'Legging Rok Panjang', 'Silver', 'L', 35),
    ('LRP-SLV-XL', 'Legging Rok Panjang', 'Silver', 'XL', 30),
    ('LRP-SLV-2XL', 'Legging Rok Panjang', 'Silver', '2XL', 25),
    ('LRP-SLV-3XL', 'Legging Rok Panjang', 'Silver', '3XL', 20),
    ('LRP-GRY-L', 'Legging Rok Panjang', 'Grey', 'L', 40),
    ('LRP-GRY-XL', 'Legging Rok Panjang', 'Grey', 'XL', 35),
    ('LRP-GRY-2XL', 'Legging Rok Panjang', 'Grey', '2XL', 30),
    ('LRP-GRY-3XL', 'Legging Rok Panjang', 'Grey', '3XL', 25),
    ('RST-BLK-L', 'Rok Standard', 'Hitam', 'L', 50),
    ('RST-BLK-XL', 'Rok Standard', 'Hitam', 'XL', 40),
    ('RST-BLK-2XL', 'Rok Standard', 'Hitam', '2XL', 30),
    ('RST-BLK-3XL', 'Rok Standard', 'Hitam', '3XL', 25),
    ('RST-NVY-L', 'Rok Standard', 'Navy', 'L', 45),
    ('RST-NVY-XL', 'Rok Standard', 'Navy', 'XL', 35),
    ('RST-NVY-2XL', 'Rok Standard', 'Navy', '2XL', 30),
    ('RST-NVY-3XL', 'Rok Standard', 'Navy', '3XL', 20),
    ('RST-DST-L', 'Rok Standard', 'Dusty', 'L', 40),
    ('RST-DST-XL', 'Rok Standard', 'Dusty', 'XL', 35),
    ('RST-DST-2XL', 'Rok Standard', 'Dusty', '2XL', 30),
    ('RST-DST-3XL', 'Rok Standard', 'Dusty', '3XL', 25),
    ('RST-MRN-L', 'Rok Standard', 'Maroon', 'L', 35),
    ('RST-MRN-XL', 'Rok Standard', 'Maroon', 'XL', 30),
    ('RST-MRN-2XL', 'Rok Standard', 'Maroon', '2XL', 25),
    ('RST-MRN-3XL', 'Rok Standard', 'Maroon', '3XL', 20),
    ('RST-LLC-L', 'Rok Standard', 'Lilac', 'L', 40),
    ('RST-LLC-XL', 'Rok Standard', 'Lilac', 'XL', 35),
    ('RST-LLC-2XL', 'Rok Standard', 'Lilac', '2XL', 30),
    ('RST-LLC-3XL', 'Rok Standard', 'Lilac', '3XL', 25),
    ('RST-SLV-L', 'Rok Standard', 'Silver', 'L', 35),
    ('RST-SLV-XL', 'Rok Standard', 'Silver', 'XL', 30),
    ('RST-SLV-2XL', 'Rok Standard', 'Silver', '2XL', 25),
    ('RST-SLV-3XL', 'Rok Standard', 'Silver', '3XL', 20),
    ('RST-GRY-L', 'Rok Standard', 'Grey', 'L', 40),
    ('RST-GRY-XL', 'Rok Standard', 'Grey', 'XL', 35),
    ('RST-GRY-2XL', 'Rok Standard', 'Grey', '2XL', 30),
    ('RST-GRY-3XL', 'Rok Standard', 'Grey', '3XL', 25)
ON CONFLICT (sku) DO NOTHING;

-- Insert sample inventory logs
INSERT INTO inventory_logs (product_id, type, qty, notes)
SELECT 
    id, 
    'INBOUND_QC', 
    stock, 
    'Initial stock from QC'
FROM products
ON CONFLICT DO NOTHING;