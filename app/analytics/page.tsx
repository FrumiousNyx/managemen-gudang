'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { CardSkeleton, Skeleton } from '@/components/skeleton'
import { TrendingUp, Package, Calendar, BarChart3, ArrowUp, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

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
  const [filteredLogs, setFilteredLogs] = useState<InventoryLog[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
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
      // Try to get from cache first
      const cachedData = cache.get(CACHE_KEYS.ANALYTICS_LOGS)
      if (cachedData) {
        setLogs(cachedData)
        setFilteredLogs(cachedData)
        setLoading(false)
        return
      }

      const { data, error } = await supabase
        .from('inventory_logs')
        .select(`
          *,
          product:products(name, sku, color, size)
        `)
        .eq('type', 'OUTBOUND_PACKING')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      const logs = data || []
      setLogs(logs)
      setFilteredLogs(logs)
      
      // Cache the results for 3 minutes (analytics data changes more frequently)
      cache.set(CACHE_KEYS.ANALYTICS_LOGS, logs, 3 * 60 * 1000)
    } catch (error) {
      console.error('Error fetching logs:', error)
      showToast('error', 'Gagal memuat data analitik')
    } finally {
      setLoading(false)
    }
  }

  const handleDateFilter = () => {
    if (!startDate || !endDate) {
      setFilteredLogs(logs)
      return
    }

    const start = new Date(startDate)
    start.setHours(0, 0, 0, 0)
    const end = new Date(endDate)
    end.setHours(23, 59, 59, 999)

    const filtered = logs.filter(log => {
      const logDate = new Date(log.created_at)
      return logDate >= start && logDate <= end
    })

    setFilteredLogs(filtered)
  }

  const resetFilter = () => {
    setStartDate('')
    setEndDate('')
    setFilteredLogs(logs)
  }

  // Calculate sales by time period
  const getTodaySales = () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return filteredLogs
      .filter(log => new Date(log.created_at) >= today)
      .reduce((sum, log) => sum + Math.abs(log.qty), 0)
  }

  const getWeekSales = () => {
    const weekAgo = new Date()
    weekAgo.setDate(weekAgo.getDate() - 7)
    return filteredLogs
      .filter(log => new Date(log.created_at) >= weekAgo)
      .reduce((sum, log) => sum + Math.abs(log.qty), 0)
  }

  const getMonthSales = () => {
    const monthAgo = new Date()
    monthAgo.setDate(monthAgo.getDate() - 30)
    return filteredLogs
      .filter(log => new Date(log.created_at) >= monthAgo)
      .reduce((sum, log) => sum + Math.abs(log.qty), 0)
  }

  // Get top 5 products by sales
  const getTopProducts = (): ProductSales[] => {
    const productMap = new Map<string, ProductSales>()

    filteredLogs.forEach(log => {
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

    filteredLogs.forEach(log => {
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

    filteredLogs.forEach(log => {
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

  const exportToPDF = () => {
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(18)
    doc.text('Analitik Penjualan', 14, 22)
    
    // Filter info
    doc.setFontSize(10)
    doc.setTextColor(100)
    if (startDate && endDate) {
      doc.text(`Periode: ${startDate} - ${endDate}`, 14, 30)
    } else {
      doc.text('Periode: Semua Data', 14, 30)
    }
    
    // Summary
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text('Ringkasan Penjualan', 14, 42)
    
    const summaryData = [
      ['Hari Ini', getTodaySales().toString()],
      ['Minggu Ini', getWeekSales().toString()],
      ['Bulan Ini', getMonthSales().toString()]
    ]
    
    autoTable(doc, {
      startY: 48,
      head: [['Periode', 'Unit']],
      body: summaryData,
      styles: {
        fontSize: 10,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: 255,
        fontStyle: 'bold'
      }
    })
    
    // Top Products
    let startY = (doc as any).lastAutoTable.finalY + 15
    doc.setFontSize(12)
    doc.text('Top 5 Produk Terlaris', 14, startY)
    
    const topProductsData = topProducts.map((product, index) => [
      `${index + 1}`,
      product.product_name,
      product.product_sku,
      `${product.color} / ${product.size}`,
      product.total_qty.toString()
    ])
    
    autoTable(doc, {
      startY: startY + 6,
      head: [['Rank', 'Nama', 'SKU', 'Detail', 'Unit']],
      body: topProductsData,
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: 255,
        fontStyle: 'bold'
      }
    })
    
    // Color Breakdown
    startY = (doc as any).lastAutoTable.finalY + 15
    doc.setFontSize(12)
    doc.text('Breakdown Warna', 14, startY)
    
    const colorData = colorBreakdown.map(([color, qty]) => {
      const totalSales = filteredLogs.reduce((sum, log) => sum + Math.abs(log.qty), 0)
      const percentage = totalSales > 0 ? ((qty / totalSales) * 100).toFixed(1) : '0'
      return [color, qty.toString(), `${percentage}%`]
    })
    
    autoTable(doc, {
      startY: startY + 6,
      head: [['Warna', 'Unit', 'Persentase']],
      body: colorData,
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: 255,
        fontStyle: 'bold'
      }
    })
    
    // Size Breakdown
    startY = (doc as any).lastAutoTable.finalY + 15
    doc.setFontSize(12)
    doc.text('Breakdown Ukuran', 14, startY)
    
    const sizeData = sizeBreakdown.map(([size, qty]) => [size, qty.toString()])
    
    autoTable(doc, {
      startY: startY + 6,
      head: [['Ukuran', 'Unit']],
      body: sizeData,
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: 255,
        fontStyle: 'bold'
      }
    })
    
    // Footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(150)
      doc.text(
        `Halaman ${i} dari ${pageCount} - Generated on ${new Date().toLocaleDateString('id-ID')}`,
        14,
        doc.internal.pageSize.height - 10
      )
    }
    
    doc.save(`analitik-penjualan-${new Date().toISOString().split('T')[0]}.pdf`)
    showToast('success', 'PDF analitik berhasil di-download')
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Date Range Filter Skeleton */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* Sales Summary Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </div>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Analitik Penjualan</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Lihat data penjualan dan produk terlaris</p>
      </div>

      {/* Date Range Filter */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-zinc-100">Filter Tanggal</h3>
          <button
            onClick={exportToPDF}
            disabled={filteredLogs.length === 0}
            className="flex items-center px-3 py-2 text-sm bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:bg-slate-800 dark:hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4 mr-1" />
            Export PDF
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDateFilter}
              className="px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
            >
              Filter
            </button>
            <button
              onClick={resetFilter}
              className="px-6 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
            >
              Reset
            </button>
          </div>
        </div>
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Top 5 Produk Terlaris</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Breakdown Warna</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
          </div>
          {colorBreakdown.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada data</p>
          ) : (
            <div className="space-y-4">
              {colorBreakdown.map(([color, qty], index) => {
                const totalSales = filteredLogs.reduce((sum, log) => sum + Math.abs(log.qty), 0)
                const percentage = totalSales > 0 ? (qty / totalSales) * 100 : 0
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
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Breakdown Ukuran</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
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
