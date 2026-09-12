/**
 * Unified Queue Manager
 * Handles both local queue and Upstash QStash based on configuration
 */

import { localQueue } from './local-queue';
import { marketplaceRateLimiter } from './rate-limiter';
import { handleStockSyncJob } from './stock-sync-handler';

export interface StockSyncJob {
  productId: string;
  platform: string;
  newStock: number;
  shopConnectionId?: string;
}

export interface LocalQueueJob {
  id: string;
  type: string;
  payload: any;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  nextRunAt: number;
}

export interface MarketplacesToSync {
  platform: string;
  shopConnectionId: string;
}

/**
 * Queue Manager for Marketplace Stock Synchronization
 */
class QueueManager {
  private useUpstash: boolean;

  constructor() {
    this.useUpstash = !!process.env.QSTASH_URL && !!process.env.QSTASH_TOKEN;
    
    // Register stock sync handler
    this.registerStockSyncHandler(handleStockSyncJob);
  }

  /**
   * Queue a stock sync job with rate limiting
   */
  async queueStockSync(job: StockSyncJob): Promise<string> {
    const rateLimitKey = job.shopConnectionId || `${job.platform}-default`;
    
    // Check rate limit before queuing
    if (!marketplaceRateLimiter.canMakeRequest(rateLimitKey)) {
      const waitTime = marketplaceRateLimiter.getTimeUntilNextRequest(rateLimitKey);
      console.log(`Rate limited for ${rateLimitKey}, delaying by ${waitTime}ms`);
      
      // Queue with delay to respect rate limit
      return localQueue.add('stock-sync', job, {
        delay: waitTime,
        maxAttempts: 3
      });
    }

    // Queue immediately if under rate limit
    return localQueue.add('stock-sync', job, {
      maxAttempts: 3
    });
  }

  /**
   * Queue multiple stock sync jobs (for syncing to all platforms)
   */
  async queueMultiPlatformSync(
    productId: string,
    newStock: number,
    platforms: MarketplacesToSync[],
    excludePlatform?: string
  ): Promise<string[]> {
    const jobs = platforms
      .filter(p => p.platform !== excludePlatform)
      .map(platform => ({
        productId,
        platform: platform.platform,
        newStock,
        shopConnectionId: platform.shopConnectionId
      }));

    const jobIds = await Promise.all(
      jobs.map(job => this.queueStockSync(job))
    );

    return jobIds;
  }

  /**
   * Register stock sync handler
   */
  registerStockSyncHandler(handler: (job: LocalQueueJob) => Promise<void>): void {
    localQueue.registerHandler('stock-sync', handler);
  }

  /**
   * Get queue status
   */
  getStatus(): { pending: number; processing: boolean } {
    return localQueue.getStatus();
  }

  /**
   * Clear all queued jobs
   */
  clear(): void {
    localQueue.clear();
  }
}

// Singleton instance
export const queueManager = new QueueManager();

export default QueueManager;