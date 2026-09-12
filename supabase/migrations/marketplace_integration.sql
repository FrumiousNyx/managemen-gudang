-- Marketplace Integration Schema for Zero-Oversell Architecture
-- This migration adds marketplace connections, SKU mappings, and order processing

-- Create marketplace_connections table
CREATE TABLE IF NOT EXISTS marketplace_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('shopee', 'tokopedia', 'tiktok')),
    shop_name VARCHAR(100) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for platform lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_connections_platform ON marketplace_connections(platform);
CREATE INDEX IF NOT EXISTS idx_marketplace_connections_shop_name ON marketplace_connections(shop_name);

-- Create marketplace_sku_mappings table
CREATE TABLE IF NOT EXISTS marketplace_sku_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('shopee', 'tokopedia', 'tiktok')),
    marketplace_item_id VARCHAR(100) NOT NULL,
    marketplace_variation_id VARCHAR(100) DEFAULT '',
    buffer_stock INTEGER DEFAULT 2 CHECK (buffer_stock >= 0),
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(platform, marketplace_item_id, marketplace_variation_id)
);

-- Create indexes for SKU mapping lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_sku_mappings_product_id ON marketplace_sku_mappings(product_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_sku_mappings_platform ON marketplace_sku_mappings(platform);
CREATE INDEX IF NOT EXISTS idx_marketplace_sku_mappings_item_id ON marketplace_sku_mappings(marketplace_item_id);

-- Create marketplace_orders table
CREATE TABLE IF NOT EXISTS marketplace_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_sn VARCHAR(100) UNIQUE NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('shopee', 'tokopedia', 'tiktok')),
    status VARCHAR(50) DEFAULT 'pending',
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for order lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_order_sn ON marketplace_orders(order_sn);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_platform ON marketplace_orders(platform);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status ON marketplace_orders(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created_at ON marketplace_orders(created_at);

-- Add updated_at trigger function if not exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_marketplace_connections_updated_at
    BEFORE UPDATE ON marketplace_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marketplace_sku_mappings_updated_at
    BEFORE UPDATE ON marketplace_sku_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Update inventory_logs table to support marketplace transactions
ALTER TABLE inventory_logs 
ADD COLUMN IF NOT EXISTS reference_id TEXT,
ADD COLUMN IF NOT EXISTS reference_type VARCHAR(50) DEFAULT 'manual';

-- Add constraint for reference_type
ALTER TABLE inventory_logs 
DROP CONSTRAINT IF EXISTS inventory_logs_reference_type_check;
ALTER TABLE inventory_logs 
ADD CONSTRAINT inventory_logs_reference_type_check 
CHECK (reference_type IN ('manual', 'marketplace'));

-- Create atomic stored procedure for processing marketplace orders
-- This ensures zero overselling with row-level locking and atomic operations
CREATE OR REPLACE FUNCTION process_marketplace_order(
    p_product_id UUID,
    p_qty INTEGER,
    p_order_sn TEXT,
    p_platform TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_stock INTEGER;
    v_result JSONB;
BEGIN
    -- Use FOR UPDATE to lock the product row and prevent race conditions
    SELECT stock INTO v_current_stock
    FROM products
    WHERE id = p_product_id
    FOR UPDATE;

    -- Check if product exists
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Product with ID % not found', p_product_id;
    END IF;

    -- Check if sufficient stock is available
    IF v_current_stock < p_qty THEN
        RAISE EXCEPTION 'Insufficient stock for product %. Required: %, Available: %', 
            p_product_id, p_qty, v_current_stock;
    END IF;

    -- Atomically update stock
    UPDATE products
    SET stock = stock - p_qty
    WHERE id = p_product_id;

    -- Insert audit record into inventory_logs
    INSERT INTO inventory_logs (
        product_id, 
        type, 
        qty, 
        notes, 
        reference_id, 
        reference_type
    )
    VALUES (
        p_product_id, 
        'OUTBOUND_PACKING', 
        -p_qty, 
        'Automated sale via ' || p_platform, 
        p_order_sn, 
        'marketplace'
    );

    -- Return success with remaining stock
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Order processed successfully',
        'remaining_stock', v_current_stock - p_qty,
        'order_sn', p_order_sn,
        'platform', p_platform
    );

    RETURN v_result;
EXCEPTION
    WHEN OTHERS THEN
        -- Return error details - transaction will be rolled back
        RETURN jsonb_build_object(
            'success', false,
            'message', SQLERRM,
            'order_sn', p_order_sn,
            'platform', p_platform
        );
END;
$$;

-- Create function to get pushable stock (considering buffer stock)
CREATE OR REPLACE FUNCTION get_pushable_stock(
    p_product_id UUID,
    p_platform VARCHAR(50)
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_stock INTEGER;
    v_buffer_stock INTEGER;
    v_pushable_stock INTEGER;
BEGIN
    -- Get current stock
    SELECT stock INTO v_current_stock
    FROM products
    WHERE id = p_product_id;

    IF NOT FOUND THEN
        RETURN 0;
    END IF;

    -- Get buffer stock for this platform mapping
    SELECT COALESCE(buffer_stock, 2) INTO v_buffer_stock
    FROM marketplace_sku_mappings
    WHERE product_id = p_product_id AND platform = p_platform;

    -- Calculate pushable stock (can't be negative)
    v_pushable_stock := GREATEST(0, v_current_stock - v_buffer_stock);

    RETURN v_pushable_stock;
END;
$$;

-- Create function to sync stock to marketplace
CREATE OR REPLACE FUNCTION sync_marketplace_stock(
    p_product_id UUID,
    p_platform VARCHAR(50),
    p_new_stock INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_mapping_id UUID;
    v_result JSONB;
BEGIN
    -- Update the synced_at timestamp for the mapping
    UPDATE marketplace_sku_mappings
    SET synced_at = NOW()
    WHERE product_id = p_product_id AND platform = p_platform
    RETURNING id INTO v_mapping_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'SKU mapping not found for product and platform'
        );
    END IF;

    -- Return success - actual API call will be handled by application layer
    v_result := jsonb_build_object(
        'success', true,
        'message', 'Stock sync timestamp updated',
        'mapping_id', v_mapping_id,
        'new_stock', p_new_stock
    );

    RETURN v_result;
END;
$$;

-- Create view for marketplace order statistics
CREATE OR REPLACE VIEW marketplace_order_stats AS
SELECT 
    platform,
    status,
    COUNT(*) as order_count,
    COUNT(DISTINCT order_sn) as unique_orders,
    MIN(created_at) as first_order,
    MAX(created_at) as last_order
FROM marketplace_orders
GROUP BY platform, status;

-- Grant necessary permissions (adjust based on your security model)
-- These are basic grants - adjust according to your Supabase RLS policies
-- GRANT ALL ON marketplace_connections TO authenticated;
-- GRANT ALL ON marketplace_sku_mappings TO authenticated;
-- GRANT ALL ON marketplace_orders TO authenticated;
-- GRANT EXECUTE ON FUNCTION process_marketplace_order TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_pushable_stock TO authenticated;
-- GRANT EXECUTE ON FUNCTION sync_marketplace_stock TO authenticated;
-- GRANT SELECT ON marketplace_order_stats TO authenticated;