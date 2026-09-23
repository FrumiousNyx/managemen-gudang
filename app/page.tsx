'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { getStockStatus, isLowStock } from '@/lib/stock-utils'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { CardSkeleton, TableSkeleton, ProductCardSkeleton, Skeleton } from '@/components/skeleton'
import { useToast } from '@/components/toast-provider'
import { Search, Package, AlertTriangle, CheckCircle, Download, Bell, ChevronDown, RotateCcw } from 'lucide-react'
import * as XLSX from 'xlsx'

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [allProducts, setAllProducts] = useState<Product[]>([]) // For filtering
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'low' | 'out'>('all')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')
  const [displayCount, setDisplayCount] = useState(100)
  const [totalCount, setTotalCount] = useState(0)
  const [returnCount, setReturnCount] = useState(0)
  const [damageCount, setDamageCount] = useState(0)
  const { showToast } = useToast()

  useEffect(() => {
    fetchProducts()

    // Request notification permission
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission)
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission)
        })
      }
    }
  }, [])

  // Smart notification: only notify once per product when it becomes low stock
  useEffect(() => {
    if (!loading && allProducts.length > 0 && notificationPermission === 'granted') {
      const lowStockProducts = allProducts.filter(p => isLowStock(p) && p.stock > 0)

      // Get previously notified products from localStorage
      const previouslyNotified = JSON.parse(localStorage.getItem('notified_low_stock_products') || '[]')

      // Find new low stock products that haven't been notified
      const newLowStockProducts = lowStockProducts.filter(p => !previouslyNotified.includes(p.id))

      if (newLowStockProducts.length > 0) {
        // Send notification for new low stock products
        const productNames = newLowStockProducts.map(p => `${p.name} (${p.color}/${p.size})`).join(', ')
        new Notification('Peringatan Stok Menipis', {
          body: `${newLowStockProducts.length} produk stok menipis: ${productNames}`,
          icon: '/favicon.ico'
        })

        // Update localStorage with newly notified products
        const updatedNotified = [...previouslyNotified, ...newLowStockProducts.map(p => p.id)]
        localStorage.setItem('notified_low_stock_products', JSON.stringify(updatedNotified))
      }

      // Remove products from notified list if they are no longer low stock
      const productsToRemoveFromNotified = previouslyNotified.filter((id: string) => {
        const product = allProducts.find(p => p.id === id)
        return product && !isLowStock(product)
      })

      if (productsToRemoveFromNotified.length > 0) {
        const updatedNotified = previouslyNotified.filter((id: string) => !productsToRemoveFromNotified.includes(id))
        localStorage.setItem('notified_low_stock_products', JSON.stringify(updatedNotified))
      }
    }
  }, [loading, allProducts])

  useEffect(() => {
    let filtered = allProducts.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.size.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // Apply status filter
    if (statusFilter === 'low') {
      filtered = filtered.filter(p => isLowStock(p) && p.stock > 0)
    } else if (statusFilter === 'out') {
      filtered = filtered.filter(p => p.stock === 0)
    }

    setFilteredProducts(filtered)
    setDisplayCount(Math.min(100, filtered.length))
  }, [searchTerm, statusFilter, allProducts])

  const fetchProducts = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized')
      setLoading(false)
      return
    }

    setLoading(true)

    try {
      // Get total count first
      const { count, error: countError } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: false })

      if (countError) throw countError

      setTotalCount(count || 0)

      // Fetch first 500 products (batch 1)
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })
        .limit(500)

      if (error) throw error

      const products = data || []
      setAllProducts(products)
      setProducts(products)
      setFilteredProducts(products)
      setDisplayCount(Math.min(100, products.length))

      // Clear cache on fetch for real-time data
      cache.delete(CACHE_KEYS.PRODUCTS)
    } catch (error) {
      console.error('Error fetching products:', error)
      showToast('error', 'Gagal memuat produk')
    } finally {
      setLoading(false)
    }
  }

  const loadMore = () => {
    setLoadingMore(true)
    // Double the display count
    const newCount = Math.min(displayCount + 100, filteredProducts.length)
    setDisplayCount(newCount)
    setLoadingMore(false)
  }

  const totalSKUs = products.length
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0)
  const lowStockCount = products.filter((p) => isLowStock(p)).length

  const exportToExcel = () => {
    const exportData = filteredProducts.map(product => ({
      SKU: product.sku,
      'Nama Produk': product.name,
      Warna: product.color,
      Ukuran: product.size,
      Stok: product.stock,
      Status: getStockStatus(product).label
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Stok Inventaris')

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // SKU
      { wch: 25 }, // Nama Produk
      { wch: 10 }, // Warna
      { wch: 8 },  // Ukuran
      { wch: 8 },  // Stok
      { wch: 10 }  // Status
    ]

    XLSX.writeFile(workbook, `stok-inventaris-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Check for low stock notifications (browser only, not in-app toast to avoid duplicates)
  useEffect(() => {
    if (!loading && products.length > 0 && notificationPermission === 'granted') {
      const lowStockProducts = products.filter(p => isLowStock(p))
      
      if (lowStockProducts.length > 0) {
        // Show single summary notification
        new Notification('Peringatan Stok Rendah', {
          body: `${lowStockProducts.length} produk dengan stok rendah perlu perhatian`,
          icon: '/favicon.ico'
        })
      }
    }
  }, [loading, products.length, notificationPermission])

  // Fetch return and damage counts for current month only
  useEffect(() => {
    const fetchReturnDamageCounts = async () => {
      if (!supabase) return

      try {
        // Get current month start date
        const now = new Date()
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        
        // Get return count for current month
        const { data: returnData, error: returnError } = await supabase
          .from('inventory_logs')
          .select('qty')
          .eq('type', 'RETURN')
          .gte('created_at', startOfMonth.toISOString())
        
        if (!returnError && returnData) {
          const totalReturns = returnData.reduce((sum, log) => sum + Math.abs(log.qty), 0)
          setReturnCount(totalReturns)
        }

        // Get damage count for current month
        const { data: damageData, error: damageError } = await supabase
          .from('inventory_logs')
          .select('qty')
          .eq('type', 'DAMAGE')
          .gte('created_at', startOfMonth.toISOString())
        
        if (!damageError && damageData) {
          const totalDamages = damageData.reduce((sum, log) => sum + Math.abs(log.qty), 0)
          setDamageCount(totalDamages)
        }
      } catch (error) {
        console.error('Error fetching return/damage counts:', error)
      }
    }

    fetchReturnDamageCounts()
  }, [])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Return & Damage Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Search Bar Skeleton */}
        <div className="mb-6">
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>

        {/* Table Skeleton - Desktop */}
        <div className="hidden md:block">
          <TableSkeleton rows={8} />
        </div>

        {/* Mobile Cards Skeleton */}
        <div className="md:hidden space-y-3">
          <ProductCardSkeleton />
          <ProductCardSkeleton />
          <ProductCardSkeleton />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Dasbor Stok</h1>
          <p className="mt-1 sm:mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Pantau level stok secara real-time</p>
        </div>
        <button
          onClick={exportToExcel}
          disabled={filteredProducts.length === 0}
          className="flex items-center px-3 sm:px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
        >
          <Download className="h-4 w-4 mr-1 sm:mr-2" />
          <span className="hidden sm:inline">Export Excel</span>
          <span className="sm:hidden">Export</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Total Jenis SKU</p>
              <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-1 sm:mt-2">{totalSKUs}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 ml-2">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600 dark:text-zinc-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Total Unit Stok</p>
              <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-1 sm:mt-2">{totalStock}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center flex-shrink-0 ml-2">
              <CheckCircle className="h-5 w-5 sm:h-6 sm:w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Stok Rendah</p>
              <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-1 sm:mt-2">{lowStockCount}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center flex-shrink-0 ml-2">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Return & Damage Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Retur Barang</p>
              <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-1 sm:mt-2">{returnCount}</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">unit bulan ini</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center flex-shrink-0 ml-2">
              <RotateCcw className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Barang Rusak</p>
              <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-1 sm:mt-2">{damageCount}</p>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">unit</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center flex-shrink-0 ml-2">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama, SKU, Warna, atau Ukuran..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'all'
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            Semua
          </button>
          <button
            onClick={() => setStatusFilter('low')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'low'
                ? 'bg-amber-500 text-white'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            Stok Menipis
          </button>
          <button
            onClick={() => setStatusFilter('out')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              statusFilter === 'out'
                ? 'bg-red-500 text-white'
                : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
            }`}
          >
            Stok Habis
          </button>
        </div>
      </div>

      {/* Data Table - Desktop */}
      <div className="hidden md:block bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
            <thead className="bg-slate-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Nama Produk
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Warna
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Ukuran
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Sisa Stok
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-800 divide-y divide-slate-200 dark:divide-zinc-800">
              {filteredProducts.slice(0, displayCount).map((product) => {
                const status = getStockStatus(product)
                return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-zinc-100">
                      {product.sku}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-900 dark:text-zinc-100">
                      {product.name}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                      {product.color}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                      {product.size}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {product.stock}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                )
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-zinc-400">
                    Tidak ada produk yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Load More Button */}
        {displayCount < filteredProducts.length && (
          <div className="px-4 py-3 border-t border-slate-200 dark:border-zinc-800">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingMore ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-slate-600 mr-2"></div>
                  Memuat...
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-2" />
                  Tampilkan Lebih Banyak ({displayCount} dari {filteredProducts.length})
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredProducts.slice(0, displayCount).map((product) => {
          const status = getStockStatus(product)
          return (
            <div key={product.id} className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{product.name}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{product.sku}</p>
                </div>
                <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full border ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Warna</p>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{product.color}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Ukuran</p>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{product.size}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Stok</p>
                  <p className="font-semibold text-slate-900 dark:text-zinc-100">{product.stock}</p>
                </div>
              </div>
            </div>
          )
        })}
        {filteredProducts.length === 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-12 text-center text-slate-500 dark:text-zinc-400">
            Tidak ada produk yang cocok dengan pencarian Anda.
          </div>
        )}
        {displayCount < filteredProducts.length && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full mt-4 flex items-center justify-center px-4 py-3 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-slate-600 mr-2"></div>
                Memuat...
              </>
            ) : (
              <>
                <ChevronDown className="h-4 w-4 mr-2" />
                Tampilkan Lebih Banyak ({displayCount} dari {filteredProducts.length})
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
