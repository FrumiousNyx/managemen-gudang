import { getStockThreshold, getStockStatus, isLowStock } from '@/lib/stock-utils'

describe('Stock Utils', () => {
  describe('getStockThreshold', () => {
    it('should return 60 for Lina products', () => {
      expect(getStockThreshold('Lina Dress')).toBe(60)
      expect(getStockThreshold('Lina Skirt')).toBe(60)
    })

    it('should return 40 for Rocela products', () => {
      expect(getStockThreshold('Rocela Top')).toBe(40)
      expect(getStockThreshold('Rocela Pants')).toBe(40)
    })

    it('should return 40 for legging rok products', () => {
      expect(getStockThreshold('Legging Rok 3/4')).toBe(40)
      expect(getStockThreshold('LR 3/4')).toBe(40)
    })

    it('should return 60 for asimetri products', () => {
      expect(getStockThreshold('Asimetri Dress')).toBe(60)
    })

    it('should return 40 as default threshold', () => {
      expect(getStockThreshold('Regular Dress')).toBe(40)
      expect(getStockThreshold('Basic Top')).toBe(40)
    })
  })

  describe('getStockStatus', () => {
    it('should return Habis status for zero stock', () => {
      const product = {
        id: '1',
        sku: 'TEST001',
        name: 'Test Product',
        color: 'Red',
        size: 'M',
        stock: 0,
        created_at: new Date().toISOString()
      }

      const status = getStockStatus(product)
      expect(status.label).toBe('Habis')
      expect(status.color).toContain('red')
    })

    it('should return Menipis status for low stock', () => {
      const product = {
        id: '1',
        sku: 'TEST001',
        name: 'Test Product',
        color: 'Red',
        size: 'M',
        stock: 20,
        created_at: new Date().toISOString()
      }

      const status = getStockStatus(product)
      expect(status.label).toBe('Menipis')
      expect(status.color).toContain('amber')
    })

    it('should return Aman status for sufficient stock', () => {
      const product = {
        id: '1',
        sku: 'TEST001',
        name: 'Test Product',
        color: 'Red',
        size: 'M',
        stock: 100,
        created_at: new Date().toISOString()
      }

      const status = getStockStatus(product)
      expect(status.label).toBe('Aman')
      expect(status.color).toContain('emerald')
    })
  })

  describe('isLowStock', () => {
    it('should return true for products below threshold', () => {
      const product = {
        id: '1',
        sku: 'TEST001',
        name: 'Regular Dress',
        color: 'Red',
        size: 'M',
        stock: 20,
        created_at: new Date().toISOString()
      }

      expect(isLowStock(product)).toBe(true)
    })

    it('should return false for products above threshold', () => {
      const product = {
        id: '1',
        sku: 'TEST001',
        name: 'Regular Dress',
        color: 'Red',
        size: 'M',
        stock: 50,
        created_at: new Date().toISOString()
      }

      expect(isLowStock(product)).toBe(false)
    })

    it('should return true for zero stock', () => {
      const product = {
        id: '1',
        sku: 'TEST001',
        name: 'Regular Dress',
        color: 'Red',
        size: 'M',
        stock: 0,
        created_at: new Date().toISOString()
      }

      expect(isLowStock(product)).toBe(true)
    })
  })
})
