// Simple in-memory cache with TTL support
class Cache {
  private cache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map()

  set(key: string, data: any, ttl: number = 5 * 60 * 1000): void {
    // Default TTL: 5 minutes
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get(key: string): any | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    // Check if expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clear expired items
  clearExpired(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }
}

// Export singleton instance
export const cache = new Cache()

// Cache keys constants
export const CACHE_KEYS = {
  PRODUCTS: 'products',
  INVENTORY_LOGS: 'inventory_logs',
  ANALYTICS_LOGS: 'analytics_logs'
}

// Auto-clear expired cache every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.clearExpired()
  }, 5 * 60 * 1000)
}
