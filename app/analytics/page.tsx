'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { TrendingUp, TrendingDown, Package, AlertTriangle } from 'lucide-react'

interface Product {
  id: string
  name: string
  sku: string
  color: string
  size: string
  stock: number
}

interface InventoryLog {
  id: string
  product_id: string
  type: string
  qty: number
  created_at: string
}

export default function Analytics() {
  const [products, setProducts] = useState<Product[]>([])
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [lowStockThreshold, setLowStockThreshold] = useState(10)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      if (!supabase) {
        console.error('Supabase not configured')
        return
      }

      const [productsData, logsData] = await Promise.all([
        supabase.from('products').select('*').order('stock', { ascending: true }),
        supabase.from('inventory_logs').select('*').order('created_at', { ascending: false })
      ])

      if (productsData.error) throw productsData.error
      if (logsData.error) throw logsData.error

      setProducts(productsData.data || [])
      setLogs(logsData.data || [])
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const lowStockProducts = products.filter(p => p.stock <= lowStockThreshold)
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0)
  const totalSKUs = products.length

  const outboundLogs = logs.filter(l => l.type === 'OUTBOUND_PACKING')
  const inboundLogs = logs.filter(l => l.type === 'INBOUND_QC')

  const totalOutbound = outboundLogs.reduce((sum, l) => sum + Math.abs(l.qty), 0)
  const totalInbound = inboundLogs.reduce((sum, l) => sum + l.qty, 0)

  // Calculate sales by product (last 30 days)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const recentOutbound = outboundLogs.filter(
    l => new Date(l.created_at) >= thirtyDaysAgo
  )

  const salesByProduct = recentOutbound.reduce((acc, log) => {
    const key = log.product_id
    acc[key] = (acc[key] || 0) + Math.abs(log.qty)
    return acc
  }, {} as Record<string, number>)

  const topSellingProducts = products
    .map(p => ({
      ...p,
      sales: salesByProduct[p.id] || 0
    }))
    .sort((a, b) => b.sales - a.sales)
    .slice(0, 10)

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-zinc-100 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-zinc-400">Memuat analitik...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">Analitik</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400">Laporan dan statistik inventaris</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Total Stok</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalStock}</p>
            </div>
            <Package className="h-12 w-12 text-slate-400 dark:text-zinc-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Total SKU</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalSKUs}</p>
            </div>
            <Package className="h-12 w-12 text-slate-400 dark:text-zinc-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Stok Masuk (30 Hari)</p>
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2 flex items-center">
                <TrendingUp className="h-6 w-6 mr-2" />
                {totalInbound}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Stok Keluar (30 Hari)</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2 flex items-center">
                <TrendingDown className="h-6 w-6 mr-2" />
                {totalOutbound}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Low Stock Alert */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="font-semibold text-slate-900 dark:text-zinc-100">Peringatan Stok Rendah</h3>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-600 dark:text-zinc-400">Threshold:</label>
            <input
              type="number"
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 10)}
              className="w-20 px-3 py-1 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 text-sm"
            />
          </div>
        </div>

        {lowStockProducts.length === 0 ? (
          <p className="text-slate-500 dark:text-zinc-400 text-center py-8">
            Semua stok dalam kondisi aman
          </p>
        ) : (
          <div className="space-y-2">
            {lowStockProducts.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800"
              >
                <div>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{product.name}</p>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">
                    {product.sku} - {product.color} ({product.size})
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{product.stock}</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">Sisa Stok</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Selling Products */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-4">Produk Terlaris (30 Hari Terakhir)</h3>
        
        {topSellingProducts.length === 0 ? (
          <p className="text-slate-500 dark:text-zinc-400 text-center py-8">
            Belum ada data penjualan
          </p>
        ) : (
          <div className="space-y-3">
            {topSellingProducts.map((product, index) => (
              <div
                key={product.id}
                className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-950 rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-zinc-800 flex items-center justify-center text-sm font-bold text-slate-600 dark:text-zinc-400">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 dark:text-zinc-100">{product.name}</p>
                    <p className="text-sm text-slate-600 dark:text-zinc-400">
                      {product.sku} - {product.color} ({product.size})
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xl font-bold text-slate-900 dark:text-zinc-100">{product.sales}</p>
                  <p className="text-xs text-slate-600 dark:text-zinc-400">Terjual</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
