/**
 * Tokopedia Marketplace API Integration
 * Handles authentication, stock updates, and order webhooks
 */

export interface TokopediaCredentials {
  clientId: string;
  clientSecret: string;
  accessToken: string;
  fsId?: string; // Fulfillment Service ID
}

export interface TokopediaStockUpdateRequest {
  sku: string;
  stock: number;
}

export interface TokopediaWebhookPayload {
  order_sn: string;
  platform: 'tokopedia';
  items: Array<{
    sku: string;
    quantity: number;
  }>;
  // Additional Tokopedia-specific fields
  total_amount?: number;
  currency?: string;
}

class TokopediaAPI {
  private credentials: TokopediaCredentials;
  private baseUrl: string = 'https://fs.tokopedia.net';

  constructor(credentials: TokopediaCredentials) {
    this.credentials = credentials;
  }

  /**
   * Make authenticated request to Tokopedia API
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' = 'POST',
    body?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.credentials.accessToken}`,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`Tokopedia API error: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Tokopedia API request failed:', error);
      throw error;
    }
  }

  /**
   * Update stock for a product
   */
  async updateStock(request: TokopediaStockUpdateRequest): Promise<{ success: boolean; message: string }> {
    try {
      const endpoint = '/inventory/v1/stock/update';
      const payload = {
        sku: request.sku,
        stock: request.stock,
      };

      const response = await this.makeRequest(endpoint, 'POST', payload);

      if (response.header?.errorCode !== '0') {
        return {
          success: false,
          message: `Tokopedia stock update failed: ${response.header?.errorMessage || 'Unknown error'}`
        };
      }

      return {
        success: true,
        message: 'Stock updated successfully on Tokopedia'
      };
    } catch (error) {
      return {
        success: false,
        message: `Tokopedia API error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get product info from Tokopedia
   */
  async getProductInfo(sku: string): Promise<any> {
    try {
      const endpoint = `/inventory/v1/fs/${this.credentials.fsId}/product/sku/${sku}`;
      return await this.makeRequest(endpoint, 'GET');
    } catch (error) {
      console.error('Failed to get Tokopedia product info:', error);
      throw error;
    }
  }

  /**
   * Validate webhook signature
   */
  static validateWebhookSignature(
    payload: string,
    signature: string,
    clientSecret: string
  ): boolean {
    const crypto = require('crypto-js');
    const expectedSignature = crypto.HmacSHA256(payload, clientSecret).toString();
    return signature === expectedSignature;
  }

  /**
   * Parse webhook payload
   */
  static parseWebhookPayload(rawPayload: any): TokopediaWebhookPayload {
    return {
      order_sn: rawPayload.order_sn || rawPayload.order_id,
      platform: 'tokopedia',
      items: rawPayload.items || rawPayload.products || [],
      total_amount: rawPayload.total_amount || rawPayload.amount,
      currency: rawPayload.currency || 'IDR',
    };
  }
}

export default TokopediaAPI;