/**
 * Outbound Stock Sync Endpoint
 * Handles stock synchronization to marketplace platforms
 * Implements buffer stock logic to prevent overselling
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ShopeeAPI, TokopediaAPI } from '@/lib/marketplace';
import { queueManager } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, newStock, platforms } = body;

    // Validate required fields
    if (!productId || newStock === undefined) {
      return NextResponse.json(
        { success: false, message: 'Missing required fields: productId and newStock' },
        { status: 400 }
      );
    }

    // Get product info
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, sku, name, stock')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      return NextResponse.json(
        { success: false, message: 'Product not found' },
        { status: 404 }
      );
    }

    // Get SKU mappings for this product
    const { data: mappings, error: mappingsError } = await supabase
      .from('marketplace_sku_mappings')
      .select('*')
      .eq('product_id', productId);

    if (mappingsError) {
      console.error('Failed to get SKU mappings:', mappingsError);
      return NextResponse.json(
        { success: false, message: 'Failed to get SKU mappings' },
        { status: 500 }
      );
    }

    if (!mappings || mappings.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No marketplace mappings found for this product' },
        { status: 404 }
      );
    }

    // Filter mappings if specific platforms requested
    const targetMappings = platforms 
      ? mappings.filter(m => platforms.includes(m.platform))
      : mappings;

    if (targetMappings.length === 0) {
      return NextResponse.json(
        { success: false, message: 'No mappings found for specified platforms' },
        { status: 404 }
      );
    }

    // Process each mapping
    const syncResults = [];
    for (const mapping of targetMappings) {
      try {
        // Calculate pushable stock considering buffer stock
        const bufferStock = mapping.buffer_stock || 2;
        const pushStock = Math.max(0, newStock - bufferStock);

        console.log(`Syncing stock for ${mapping.platform}: ${product.name} (SKU: ${product.sku})`);
        console.log(`Current stock: ${newStock}, Buffer: ${bufferStock}, Pushable: ${pushStock}`);

        // Initialize appropriate API client
        let apiResult;
        if (mapping.platform === 'shopee') {
          const shopeeCredentials = {
            partnerId: process.env.SHOPEE_PARTNER_ID || '',
            partnerKey: process.env.SHOPEE_PARTNER_KEY || '',
            accessToken: await getShopeeAccessToken(mapping.platform),
          };

          const shopeeAPI = new ShopeeAPI(shopeeCredentials);
          apiResult = await shopeeAPI.updateStock({
            itemId: mapping.marketplace_item_id,
            variationId: mapping.marketplace_variation_id || undefined,
            stock: pushStock
          });
        } else if (mapping.platform === 'tokopedia') {
          const tokopediaCredentials = {
            clientId: process.env.TOKOPEDIA_CLIENT_ID || '',
            clientSecret: process.env.TOKOPEDIA_CLIENT_SECRET || '',
            accessToken: await getTokopediaAccessToken(mapping.platform),
          };

          const tokopediaAPI = new TokopediaAPI(tokopediaCredentials);
          apiResult = await tokopediaAPI.updateStock({
            sku: mapping.marketplace_item_id,
            stock: pushStock
          });
        } else {
          apiResult = {
            success: false,
            message: `Platform ${mapping.platform} not yet implemented`
          };
        }

        // Update synced_at timestamp if successful
        if (apiResult.success) {
          await supabase
            .from('marketplace_sku_mappings')
            .update({ synced_at: new Date().toISOString() })
            .eq('id', mapping.id);
        }

        syncResults.push({
          platform: mapping.platform,
          marketplaceItemId: mapping.marketplace_item_id,
          marketplaceVariationId: mapping.marketplace_variation_id,
          bufferStock,
          pushStock,
          success: apiResult.success,
          message: apiResult.message
        });

      } catch (error) {
        console.error(`Error syncing to ${mapping.platform}:`, error);
        syncResults.push({
          platform: mapping.platform,
          marketplaceItemId: mapping.marketplace_item_id,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const allSuccess = syncResults.every(r => r.success);

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'Stock synced successfully to all platforms' : 'Stock sync partially successful',
      productId,
      productName: product.name,
      productSku: product.sku,
      newStock,
      results: syncResults
    }, { status: allSuccess ? 200 : 207 });

  } catch (error) {
    console.error('Stock sync error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Helper function to get Shopee access token
async function getShopeeAccessToken(platform: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('marketplace_connections')
      .select('access_token')
      .eq('platform', platform)
      .single();

    if (error || !data) {
      console.error('Failed to get Shopee access token:', error);
      return '';
    }

    return data.access_token;
  } catch (error) {
    console.error('Error getting Shopee access token:', error);
    return '';
  }
}

// Helper function to get Tokopedia access token
async function getTokopediaAccessToken(platform: string): Promise<string> {
  try {
    const { data, error } = await supabase
      .from('marketplace_connections')
      .select('access_token')
      .eq('platform', platform)
      .single();

    if (error || !data) {
      console.error('Failed to get Tokopedia access token:', error);
      return '';
    }

    return data.access_token;
  } catch (error) {
    console.error('Error getting Tokopedia access token:', error);
    return '';
  }
}

// Support GET for endpoint testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Stock sync endpoint is active',
    supportedPlatforms: ['shopee', 'tokopedia'],
    description: 'POST with { productId, newStock, platforms? } to sync stock',
    timestamp: new Date().toISOString()
  });
}