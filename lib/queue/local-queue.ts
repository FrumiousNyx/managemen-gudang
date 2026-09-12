/**
 * Local Queue Implementation (Fallback)
 * Provides queue functionality without external dependencies
 * Can be replaced with Upstash QStash when ready
 */

import type { LocalQueueJob } from './queue-manager';

class LocalQueue {
  private queue: Map<string, LocalQueueJob> = new Map();
  private processing: boolean = false;
  private handlers: Map<string, (job: LocalQueueJob) => Promise<void>> = new Map();

  /**
   * Register a handler for a specific job type
   */
  registerHandler(type: string, handler: (job: LocalQueueJob) => Promise<void>): void {
    this.handlers.set(type, handler);
  }

  /**
   * Add a job to the queue
   */
  async add(type: string, payload: any, options: { delay?: number; maxAttempts?: number } = {}): Promise<string> {
    const job: LocalQueueJob = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      payload,
      attempts: 0,
      maxAttempts: options.maxAttempts || 3,
      createdAt: Date.now(),
      nextRunAt: Date.now() + (options.delay || 0)
    };

    this.queue.set(job.id, job);
    
    // Start processing if not already running
    if (!this.processing) {
      this.process();
    }

    return job.id;
  }

  /**
   * Process jobs in the queue
   */
  private async process(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;

    while (this.queue.size > 0) {
      const now = Date.now();
      const readyJobs = Array.from(this.queue.values())
        .filter(job => job.nextRunAt <= now)
        .sort((a, b) => a.nextRunAt - b.nextRunAt);

      if (readyJobs.length === 0) {
        // No jobs ready to process, wait a bit
        await this.sleep(100);
        continue;
      }

      const job = readyJobs[0];
      const handler = this.handlers.get(job.type);

      if (!handler) {
        console.error(`No handler registered for job type: ${job.type}`);
        this.queue.delete(job.id);
        continue;
      }

      try {
        await handler(job);
        this.queue.delete(job.id);
      } catch (error) {
        console.error(`Error processing job ${job.id}:`, error);
        
        job.attempts++;
        if (job.attempts >= job.maxAttempts) {
          console.error(`Job ${job.id} failed after ${job.maxAttempts} attempts`);
          this.queue.delete(job.id);
        } else {
          // Exponential backoff
          const backoffMs = Math.pow(2, job.attempts) * 1000;
          job.nextRunAt = Date.now() + backoffMs;
          this.queue.set(job.id, job);
        }
      }
    }

    this.processing = false;
  }

  /**
   * Get queue status
   */
  getStatus(): { pending: number; processing: boolean } {
    return {
      pending: this.queue.size,
      processing: this.processing
    };
  }

  /**
   * Clear all jobs
   */
  clear(): void {
    this.queue.clear();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton instance
export const localQueue = new LocalQueue();

export default LocalQueue;