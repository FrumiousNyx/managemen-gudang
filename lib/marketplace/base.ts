/**
 * Base Marketplace Interface
 * Defines common structure for all marketplace integrations
 */

export interface MarketplaceAPI {
  updateStock(request: any): Promise<{ success: boolean; message: string }>;
  getProductInfo(identifier: string): Promise<any>;
}

export interface MarketplaceCredentials {
  accessToken: string;
  [key: string]: any;
}

export interface MarketplaceWebhookPayload {
  order_sn: string;
  platform: string;
  items: Array<{
    [key: string]: any;
    quantity?: number;
    model_qty?: number;
  }>;
  total_amount?: number;
  currency?: string;
}

export interface StockSyncResult {
  platform: string;
  success: boolean;
  message: string;
  timestamp: number;
}