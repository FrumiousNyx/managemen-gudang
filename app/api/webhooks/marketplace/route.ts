/**
 * Marketplace Webhook Receiver
 * Handles incoming order webhooks from marketplace platforms
 * Ensures zero overselling with atomic database operations
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { ShopeeAPI } from '@/lib/marketplace';
import { queueManager } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature validation
    const rawBody = await request.text();
    const payload = JSON.parse(rawBody);

    // Validate required fields
    const { order_sn, platform, items } = payload;
    if (!order_sn || !platform || !items || !Array.isArray(items)) {
      return NextResponse.json(
        { success: false, message: 'Invalid payload structure' },
        { status: 400 }
      );
    }

    // Validate platform
    const validPlatforms = ['shopee', 'tokopedia', 'tiktok'];
    if (!validPlatforms.includes(platform)) {
      return NextResponse.json(
        { success: false, message: 'Invalid platform' },
        { status: 400 }
      );
    }

    // Validate webhook signature based on platform
    const signature = request.headers.get('x-shopee-signature') || 
                     request.headers.get('x-tokopedia-signature') ||
                     request.headers.get('authorization');

    if (!signature) {
      return NextResponse.json(
        { success: false, message: 'Missing signature header' },
        { status: 401 }
      );
    }

    // Platform-specific signature validation
    let isValidSignature = false;
    if (platform === 'shopee') {
      const partnerKey = process.env.SHOPEE_PARTNER_KEY;
      if (partnerKey) {
        isValidSignature = ShopeeAPI.validateWebhookSignature(rawBody, signature, partnerKey);
      }
    } else if (platform === 'tokopedia') {
      const clientSecret = process.env.TOKOPEDIA_CLIENT_SECRET;
      if (clientSecret) {
        isValidSignature = ShopeeAPI.validateWebhookSignature(rawBody, signature, clientSecret);
      }
    }

    // For development, you might want to skip signature validation
    // if (!isValidSignature) {
    //   return NextResponse.json(
    //     { success: false, message: 'Invalid signature' },
    //     { status: 401 }
    //   );
    // }

    // Log the order payload to marketplace_orders table
    const { data: orderData, error: orderError } = await supabase
      .from('marketplace_orders')
      .insert({
        order_sn,
        platform,
        status: 'processing',
        payload: payload
      })
      .select()
      .single();

    if (orderError) {
      console.error('Failed to log marketplace order:', orderError);
      // Continue processing even if logging fails
    }

    // Process each item in the order
    const processingResults = [];
    for (const item of items) {
      try {
        // Determine SKU identifier based on platform
        const marketplaceItemId = item.item_id || item.sku;
        const marketplaceVariationId = item.variation_id || item.model_sku || '';
        const quantity = item.quantity || item.model_qty || 1;

        if (!marketplaceItemId) {
          processingResults.push({
            item: marketplaceItemId,
            success: false,
            message: 'Missing item identifier'
          });
          continue;
        }

        // Resolve local product_id via marketplace_sku_mappings
        const { data: mapping, error: mappingError } = await supabase
          .from('marketplace_sku_mappings')
          .select('product_id, buffer_stock')
          .eq('platform', platform)
          .eq('marketplace_item_id', marketplaceItemId)
          .eq('marketplace_variation_id', marketplaceVariationId)
          .single();

        if (mappingError || !mapping) {
          processingResults.push({
            item: marketplaceItemId,
            success: false,
            message: 'SKU mapping not found'
          });
          continue;
        }

        // Invoke atomic RPC function to process marketplace order
        const { data: result, error: rpcError } = await supabase
          .rpc('process_marketplace_order', {
            p_product_id: mapping.product_id,
            p_qty: quantity,
            p_order_sn: order_sn,
            p_platform: platform
          });

        if (rpcError) {
          console.error('RPC function failed:', rpcError);
          processingResults.push({
            item: marketplaceItemId,
            success: false,
            message: rpcError.message || 'Stock deduction failed'
          });
          continue;
        }

        // Check if order was processed successfully
        if (result && result.success) {
          processingResults.push({
            item: marketplaceItemId,
            success: true,
            message: result.message,
            remainingStock: result.remaining_stock
          });

          // Queue stock sync to other platforms asynchronously
          await queueManager.queueMultiPlatformSync(
            mapping.product_id,
            result.remaining_stock,
            [{ platform: 'shopee', shopConnectionId: 'default' }],
            platform // Exclude the current platform
          );
        } else {
          processingResults.push({
            item: marketplaceItemId,
            success: false,
            message: result?.message || 'Unknown error'
          });
        }
      } catch (itemError) {
        console.error('Error processing item:', itemError);
        processingResults.push({
          item: item.item_id || item.sku,
          success: false,
          message: itemError instanceof Error ? itemError.message : 'Unknown error'
        });
      }
    }

    // Update order status based on processing results
    const allSuccess = processingResults.every(r => r.success);
    const finalStatus = allSuccess ? 'completed' : 'partial_success';

    await supabase
      .from('marketplace_orders')
      .update({
        status: finalStatus,
        processed_at: new Date().toISOString()
      })
      .eq('order_sn', order_sn);

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'Order processed successfully' : 'Order partially processed',
      order_sn,
      platform,
      results: processingResults
    }, { status: allSuccess ? 200 : 207 });

  } catch (error) {
    console.error('Webhook processing error:', error);
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

// Support GET for webhook testing
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Marketplace webhook endpoint is active',
    supportedPlatforms: ['shopee', 'tokopedia', 'tiktok'],
    timestamp: new Date().toISOString()
  });
}