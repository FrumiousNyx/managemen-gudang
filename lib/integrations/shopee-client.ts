/**
 * Shopee API Client
 * Handles authentication and API calls to Shopee Partner API
 */

export interface ShopeeConfig {
  partnerId: string
  partnerKey: string
  shopId: string
  apiUrl?: string
}

export interface ShopeeProduct {
  item_id: string
  item_name: string
  item_sku: string
  stock: number
  price: number
  status: string
}

export class ShopeeClient {
  private config: ShopeeConfig

  constructor(config: ShopeeConfig) {
    this.config = {
      apiUrl: 'https://partner.shopeemobile.com',
      ...config
    }
  }

  /**
   * Generate signature for Shopee API authentication
   * Note: For production, implement proper HMAC-SHA256 signature
   */
  private async generateSignature(path: string, timestamp: number, body?: string): Promise<string> {
    const baseString = `${this.config.partnerId}${path}${timestamp}${body || ''}`
    
    // Simple hash for demo - replace with proper HMAC-SHA256 in production
    let hash = 0
    for (let i = 0; i < baseString.length; i++) {
      const char = baseString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32bit integer
    }
    
    return Math.abs(hash).toString(16).padStart(32, '0')
  }

  /**
   * Make authenticated request to Shopee API
   */
  private async makeRequest(path: string, method: string = 'GET', body?: any) {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await this.generateSignature(path, timestamp, body ? JSON.stringify(body) : undefined)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `SHA256 ${signature}`,
      'X-Shopee-Timestamp': timestamp.toString(),
      'X-Shopee-Partner-Id': this.config.partnerId,
      'X-Shopee-Shop-Id': this.config.shopId
    }

    const url = `${this.config.apiUrl}${path}`

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      })

      if (!response.ok) {
        throw new Error(`Shopee API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('Shopee API request failed:', error)
      throw error
    }
  }

  /**
   * Get products from Shopee shop
   */
  async getProducts(offset: number = 0, pageSize: number = 100): Promise<ShopeeProduct[]> {
    const path = '/api/v2/product/get_item_list'
    const body = {
      offset,
      page_size: pageSize,
      item_status: 'NORMAL'
    }

    const response = await this.makeRequest(path, 'POST', body)
    return response.data?.item_list || []
  }

  /**
   * Update product stock on Shopee
   */
  async updateStock(itemId: string, stock: number): Promise<boolean> {
    const path = '/api/v2/product/update_stock'
    const body = {
      item_id: itemId,
      stock
    }

    const response = await this.makeRequest(path, 'POST', body)
    return response.data?.success || false
  }

  /**
   * Sync product stock from local to Shopee
   */
  async syncStockToShopee(localSku: string, localStock: number): Promise<boolean> {
    try {
      // First, find the product by SKU
      const products = await this.getProducts()
      const product = products.find(p => p.item_sku === localSku)

      if (!product) {
        console.warn(`Product with SKU ${localSku} not found in Shopee`)
        return false
      }

      // Update stock if different
      if (product.stock !== localStock) {
        return await this.updateStock(product.item_id, localStock)
      }

      return true
    } catch (error) {
      console.error('Failed to sync stock to Shopee:', error)
      return false
    }
  }
}
