/**
 * Shopee Marketplace API Integration
 * Handles authentication, stock updates, and order webhooks
 */

export interface ShopeeCredentials {
  partnerId: string;
  partnerKey: string;
  accessToken: string;
  shopId?: string;
}

export interface ShopeeStockUpdateRequest {
  itemId: string;
  variationId?: string;
  stock: number;
}

export interface ShopeeWebhookPayload {
  order_sn: string;
  platform: 'shopee';
  items: Array<{
    item_id: string;
    variation_id?: string;
    model_qty: number;
  }>;
  // Additional Shopee-specific fields
  total_amount?: number;
  currency?: string;
}

class ShopeeAPI {
  private credentials: ShopeeCredentials;
  private baseUrl: string = 'https://partner.shopeemobile.com';

  constructor(credentials: ShopeeCredentials) {
    this.credentials = credentials;
  }

  /**
   * Generate Shopee API signature
   */
  private generateSignature(path: string, timestamp: number, body?: any): string {
    const crypto = require('crypto-js');
    const baseString = `${this.credentials.partnerId}${path}${timestamp}${this.credentials.accessToken}${body ? JSON.stringify(body) : ''}`;
    return crypto.SHA256(baseString + this.credentials.partnerKey).toString();
  }

  /**
   * Make authenticated request to Shopee API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' = 'POST',
    body?: any
  ): Promise<any> {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = this.generateSignature(endpoint, timestamp, body);

    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `SHA256 ${this.credentials.partnerId}:${signature}:${timestamp}`,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Shopee API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Shopee API request failed:', error);
      throw error;
    }
  }

  /**
   * Update stock for a product
   */
  async updateStock(request: ShopeeStockUpdateRequest): Promise<{ success: boolean; message: string }> {
    try {
      const endpoint = '/api/v2/product/update_stock';
      const payload = {
        item_id: request.itemId,
        variation_id: request.variationId || 0,
        stock: request.stock,
      };

      const response = await this.makeRequest(endpoint, 'POST', payload);

      if (response.error !== '') {
        return {
          success: false,
          message: `Shopee stock update failed: ${response.error}`
        };
      }

      return {
        success: true,
        message: 'Stock updated successfully on Shopee'
      };
    } catch (error) {
      return {
        success: false,
        message: `Shopee API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get product info from Shopee
   */
  async getProductInfo(itemId: string): Promise<any> {
    try {
      const endpoint = '/api/v2/product/get_item_detail';
      const payload = { item_id: itemId };

      return await this.makeRequest(endpoint, 'POST', payload);
    } catch (error) {
      console.error('Failed to get Shopee product info:', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    partnerKey: string
  ): boolean {
    const crypto = require('crypto-js');
    const expectedSignature = crypto.HmacSHA256(payload, partnerKey).toString();
    return signature === expectedSignature;
  }

  /**
   * Parse webhook payload
   */
  static parseWebhookPayload(rawPayload: any): ShopeeWebhookPayload {
    return {
      order_sn: rawPayload.order_sn || rawPayload.ordersn,
      platform: 'shopee',
      items: rawPayload.items || [],
      total_amount: rawPayload.total_amount,
      currency: rawPayload.currency,
    };
  }
}

export default ShopeeAPI;