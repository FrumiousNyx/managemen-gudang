import { supabase } from './supabase'

/**
 * Subscribe to real-time product updates
 */
export function subscribeToProducts(callback: (payload: any) => void) {
  if (!supabase) return null

  const subscription = supabase
    .channel('products-changes')
    .on(
      'postgres_changes',
      {
        event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
        schema: 'public',
        table: 'products'
      },
      (payload) => {
        console.log('Product change detected:', payload)
        callback(payload)
      }
    )
    .subscribe()

  return subscription
}

/**
 * Subscribe to real-time inventory log updates
 */
export function subscribeToInventoryLogs(callback: (payload: any) => void) {
  if (!supabase) return null

  const subscription = supabase
    .channel('inventory-logs-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_logs'
      },
      (payload) => {
        console.log('Inventory log change detected:', payload)
        callback(payload)
      }
    )
    .subscribe()

  return subscription
}

/**
 * Unsubscribe from a Supabase channel
 */
export function unsubscribeFromChannel(subscription: any) {
  if (subscription) {
    supabase?.removeChannel(subscription)
  }
}
