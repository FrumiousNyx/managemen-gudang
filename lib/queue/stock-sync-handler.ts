/**
 * Stock Sync Queue Handler
 * Processes queued stock sync jobs with rate limiting
 */

import { supabase } from '@/lib/supabase';
import { ShopeeAPI, TokopediaAPI } from '@/lib/marketplace';
import type { StockSyncJob, LocalQueueJob } from './queue-manager';

/**
 * Handle stock sync job processing
 */
export async function handleStockSyncJob(job: LocalQueueJob): Promise<void> {
  const payload = job.payload as StockSyncJob;
  const { productId, platform, newStock, shopConnectionId } = payload;

  console.log(`Processing stock sync job for ${platform}: Product ${productId}, Stock ${newStock}`);

  try {
    // Get product info
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('id, sku, name, stock')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error(`Product not found: ${productId}`);
      throw new Error(`Product not found: ${productId}`);
    }

    // Get SKU mapping for this platform
    const { data: mapping, error: mappingError } = await supabase
      .from('marketplace_sku_mappings')
      .select('*')
      .eq('product_id', productId)
      .eq('platform', platform)
      .single();

    if (mappingError || !mapping) {
      console.error(`SKU mapping not found for ${platform}`);
      throw new Error(`SKU mapping not found for ${platform}`);
    }

    // Calculate pushable stock considering buffer stock
    const bufferStock = mapping.buffer_stock || 2;
    const pushStock = Math.max(0, newStock - bufferStock);

    console.log(`Calculating pushable stock: ${newStock} - ${bufferStock} = ${pushStock}`);

    // Initialize appropriate API client and sync stock
    let apiResult;
    if (platform === 'shopee') {
      const shopeeCredentials = {
        partnerId: process.env.SHOPEE_PARTNER_ID || '',
        partnerKey: process.env.SHOPEE_PARTNER_KEY || '',
        accessToken: await getShopeeAccessToken(platform),
      };

      const shopeeAPI = new ShopeeAPI(shopeeCredentials);
      apiResult = await shopeeAPI.updateStock({
        itemId: mapping.marketplace_item_id,
        variationId: mapping.marketplace_variation_id || undefined,
        stock: pushStock
      });
    } else if (platform === 'tokopedia') {
      const tokopediaCredentials = {
        clientId: process.env.TOKOPEDIA_CLIENT_ID || '',
        clientSecret: process.env.TOKOPEDIA_CLIENT_SECRET || '',
        accessToken: await getTokopediaAccessToken(platform),
      };

      const tokopediaAPI = new TokopediaAPI(tokopediaCredentials);
      apiResult = await tokopediaAPI.updateStock({
        sku: mapping.marketplace_item_id,
        stock: pushStock
      });
    } else {
      throw new Error(`Platform ${platform} not yet implemented`);
    }

    // Update synced_at timestamp if successful
    if (apiResult.success) {
      await supabase
        .from('marketplace_sku_mappings')
        .update({ synced_at: new Date().toISOString() })
        .eq('id', mapping.id);

      console.log(`Successfully synced stock to ${platform}: ${apiResult.message}`);
    } else {
      throw new Error(`Failed to sync stock to ${platform}: ${apiResult.message}`);
    }

  } catch (error) {
    console.error(`Stock sync job failed for ${platform}:`, error);
    throw error; // This will trigger retry logic
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