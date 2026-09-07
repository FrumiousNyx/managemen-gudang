import { Product } from './supabase'

export interface StockStatus {
  label: string
  color: string
}

/**
 * Get stock threshold based on product name category
 */
export function getStockThreshold(productName: string): number {
  const lowerName = productName.toLowerCase()
  
  if (lowerName.includes('lina')) {
    return 60
  } else if (lowerName.includes('rocela')) {
    return 40
  } else if (lowerName.includes('legging rok') || lowerName.includes('lr 3/4')) {
    return 40
  } else if (lowerName.includes('asimetri')) {
    return 60
  }
  
  // Default threshold
  return 40
}

/**
 * Get centralized stock status for a product
 * This ensures consistency across Dashboard, Products, and History pages
 */
export function getStockStatus(product: Product): StockStatus {
  const threshold = getStockThreshold(product.name)
  
  if (product.stock === 0) {
    return {
      label: 'Habis',
      color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900'
    }
  }
  
  if (product.stock < threshold) {
    return {
      label: 'Menipis',
      color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900'
    }
  }
  
  return {
    label: 'Aman',
    color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900'
  }
}

/**
 * Check if a product is considered low stock
 */
export function isLowStock(product: Product): boolean {
  const threshold = getStockThreshold(product.name)
  return product.stock < threshold
}
