'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { TrendingUp, Package, Calendar, BarChart3, ArrowUp } from 'lucide-react'

interface InventoryLog {
  id: string
  product_id: string
  type: string
  qty: number
  created_at: string
  product: {
    name: string
    sku: string
    color: string
    size: string
  }
}

interface ProductSales {
  product_name: string
  product_sku: string
  total_qty: number
  color: string
  size: string
}

export default function Analytics() {
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [])

  const fetchLogs = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('inventory_logs')
        .select(`
          *,
          product:products(name, sku, color, size)
        `)
        .eq('type', 'OUTBOUND_PACKING')
        .order('created_at', { ascending: false })

      if (error) throw error
      setLogs(data || [])
    } catch (error) {
      console.error('Error fetching logs:', error)
      showToast('error', 'Gagal memuat data analitik')
    } finally {
      setLoading(false)
    }
  }

  // Calculate sales by time period
  const getTodaySales = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return logs
      .filter(log => new Date(log.created_at) >= today)
      .reduce((sum, log) => sum + Math.abs(log.qty), 0)
  }

  const getWeekSales = () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return logs
      .filter(log => new Date(log.created_at) >= weekAgo)
      .reduce((sum, log) => sum + Math.abs(log.qty), 0)
  }

  const getMonthSales = () => {
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    return logs
      .filter(log => new Date(log.created_at) >= monthAgo)
      .reduce((sum, log) => sum + Math.abs(log.qty), 0)
  }

  // Get top 5 products by sales
  const getTopProducts = (): ProductSales[] => {
    const productMap = new Map<string, ProductSales>()

    logs.forEach(log => {
      if (!log.product) return
      const key = `${log.product.sku}-${log.product.color}-${log.product.size}`
      const existing = productMap.get(key)

      if (existing) {
        existing.total_qty += Math.abs(log.qty)
      } else {
        productMap.set(key, {
          product_name: log.product.name,
          product_sku: log.product.sku,
          total_qty: Math.abs(log.qty),
          color: log.product.color,
          size: log.product.size
        })
      }
    })

    return Array.from(productMap.values())
      .sort((a, b) => b.total_qty - a.total_qty)
      .slice(0, 5)
  }

  // Get breakdown by color
  const getColorBreakdown = () => {
    const colorMap = new Map<string, number>()

    logs.forEach(log => {
      if (!log.product) return
      const existing = colorMap.get(log.product.color) || 0
      colorMap.set(log.product.color, existing + Math.abs(log.qty))
    })

    return Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }

  // Get breakdown by size
  const getSizeBreakdown = () => {
    const sizeMap = new Map<string, number>()

    logs.forEach(log => {
      if (!log.product) return
      const existing = sizeMap.get(log.product.size) || 0
      sizeMap.set(log.product.size, existing + Math.abs(log.qty))
    })

    return Array.from(sizeMap.entries())
      .sort((a, b) => b[1] - a[1])
  }

  const topProducts = getTopProducts()
  const colorBreakdown = getColorBreakdown()
  const sizeBreakdown = getSizeBreakdown()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-zinc-800 border-t-slate-900 dark:border-t-zinc-100"></div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Analitik Penjualan</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Lihat data penjualan dan produk terlaris</p>
      </div>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Penjualan Hari Ini</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{getTodaySales()}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">unit</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Penjualan Minggu Ini</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{getWeekSales()}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">unit</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Penjualan Bulan Ini</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{getMonthSales()}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">unit</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 5 Products */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Top 5 Produk Terlaris</h2>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada data penjualan</p>
          ) : (
            <div className="space-y-4">
              {topProducts.map((product, index) => (
                <div key={`${product.product_sku}-${index}`} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400' :
                        index === 1 ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300' :
                        index === 2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400' :
                        'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {index + 1}
                      </span>
                      <p className="font-medium text-slate-900 dark:text-zinc-100">{product.product_name}</p>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                      {product.product_sku} • {product.color} • {product.size}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{product.total_qty}</p>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">unit</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Color Breakdown */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <ArrowUp className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Breakdown Warna</h2>
          </div>
          {colorBreakdown.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada data</p>
          ) : (
            <div className="space-y-4">
              {colorBreakdown.map(([color, qty], index) => {
                const percentage = logs.length > 0 ? (qty / getMonthSales()) * 100 : 0
                return (
                  <div key={color} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">{color}</span>
                      <span className="text-sm text-slate-500 dark:text-zinc-400">{qty} unit</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 dark:bg-emerald-400 rounded-full transition-all"
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Size Breakdown */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Breakdown Ukuran</h2>
          </div>
          {sizeBreakdown.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada data</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {sizeBreakdown.map(([size, qty]) => (
                <div key={size} className="bg-slate-50 dark:bg-zinc-950 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100">{qty}</p>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{size}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
