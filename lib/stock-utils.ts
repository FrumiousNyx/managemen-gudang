import { Product } from './supabase'

export interface StockStatus {
  label: string
  color: string
}

/**
 * Get stock threshold based on product name category (fallback for legacy data)
 */
export function getStockThresholdByName(productName: string): number {
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
 * Get stock threshold from product (database field with fallback)
 */
export function getStockThreshold(product: Product): number {
  // Prefer database field if available and valid
  if (product.stock_threshold && product.stock_threshold > 0) {
    return product.stock_threshold
  }
  // Fallback to name-based logic for legacy data
  return getStockThresholdByName(product.name)
}

/**
 * Get centralized stock status for a product
 * This ensures consistency across Dashboard, Products, and History pages
 */
export function getStockStatus(product: Product): StockStatus {
  const threshold = getStockThreshold(product)
  
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
  const threshold = getStockThreshold(product)
  return product.stock < threshold
}

/**
 * Get label for return reason
 */
export function getReturnReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    'customer_return': 'Retur Customer',
    'wrong_item': 'Salah Item',
    'defective': 'Cacat',
    'expired': 'Kedaluwarsa',
    'size_issue': 'Masalah Ukuran',
    'color_issue': 'Masalah Warna',
    'damaged_packaging': 'Kemasan Rusak',
    'other': 'Lainnya'
  }
  return labels[reason] || reason
}

/**
 * Get label for damage type
 */
export function getDamageTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'broken': 'Pecah/Rusak',
    'damaged_packaging': 'Kemasan Rusak',
    'stained': 'Noda',
    'lost': 'Hilang',
    'torn': 'Robek',
    'water_damage': 'Kerusakan Air',
    'mold': 'Jamur',
    'other': 'Lainnya'
  }
  return labels[type] || type
}

/**
 * Get all return reason options
 */
export function getReturnReasonOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'customer_return', label: 'Retur Customer' },
    { value: 'wrong_item', label: 'Salah Item' },
    { value: 'defective', label: 'Cacat' },
    { value: 'expired', label: 'Kedaluwarsa' },
    { value: 'size_issue', label: 'Masalah Ukuran' },
    { value: 'color_issue', label: 'Masalah Warna' },
    { value: 'damaged_packaging', label: 'Kemasan Rusak' },
    { value: 'other', label: 'Lainnya' }
  ]
}

/**
 * Get all damage type options
 */
export function getDamageTypeOptions(): Array<{ value: string; label: string }> {
  return [
    { value: 'broken', label: 'Pecah/Rusak' },
    { value: 'damaged_packaging', label: 'Kemasan Rusak' },
    { value: 'stained', label: 'Noda' },
    { value: 'lost', label: 'Hilang' },
    { value: 'torn', label: 'Robek' },
    { value: 'water_damage', label: 'Kerusakan Air' },
    { value: 'mold', label: 'Jamur' },
    { value: 'other', label: 'Lainnya' }
  ]
}
