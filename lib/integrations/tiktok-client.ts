/**
 * TikTok Shop API Client
 * Handles authentication and API calls to TikTok Shop Partner API
 */

export interface TikTokConfig {
  appKey: string
  appSecret: string
  shopId: string
  apiUrl?: string
}

export interface TikTokProduct {
  id: string
  name: string
  sku: string
  stock: number
  price: number
  status: string
}

export class TikTokClient {
  private config: TikTokConfig

  constructor(config: TikTokConfig) {
    this.config = {
      apiUrl: 'https://partner.tiktokshop.com',
      ...config
    }
  }

  /**
   * Generate signature for TikTok Shop API authentication
   * Note: For production, implement proper HMAC-SHA256 signature
   */
  private async generateSignature(path: string, timestamp: number, body?: string): Promise<string> {
    const baseString = `${this.config.appKey}${path}${timestamp}${body || ''}`
    
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
   * Make authenticated request to TikTok Shop API
   */
  private async makeRequest(path: string, method: string = 'GET', body?: any) {
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await this.generateSignature(path, timestamp, body ? JSON.stringify(body) : undefined)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `SHA256 ${signature}`,
      'X-Tiktok-Timestamp': timestamp.toString(),
      'X-Tiktok-App-Key': this.config.appKey,
      'X-Tiktok-Shop-Id': this.config.shopId
    }

    const url = `${this.config.apiUrl}${path}`

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
      })

      if (!response.ok) {
        throw new Error(`TikTok Shop API error: ${response.status} ${response.statusText}`)
      }

      return await response.json()
    } catch (error) {
      console.error('TikTok Shop API request failed:', error)
      throw error
    }
  }

  /**
   * Get products from TikTok Shop
   */
  async getProducts(offset: number = 0, pageSize: number = 100): Promise<TikTokProduct[]> {
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
   * Update product stock on TikTok Shop
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
   * Sync product stock from local to TikTok Shop
   */
  async syncStockToTikTok(localSku: string, localStock: number): Promise<boolean> {
    try {
      // First, find the product by SKU
      const products = await this.getProducts()
      const product = products.find(p => p.sku === localSku)

      if (!product) {
        console.warn(`Product with SKU ${localSku} not found in TikTok Shop`)
        return false
      }

      // Update stock if different
      if (product.stock !== localStock) {
        return await this.updateStock(product.id, localStock)
      }

      return true
    } catch (error) {
      console.error('Failed to sync stock to TikTok Shop:', error)
      return false
    }
  }
}
