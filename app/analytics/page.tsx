'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { CardSkeleton, Skeleton } from '@/components/skeleton'
import { TrendingUp, Package, Calendar, BarChart3, ArrowUp, Download, RotateCcw, AlertTriangle, RefreshCw } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { getReturnReasonLabel, getDamageTypeLabel } from '@/lib/stock-utils'

interface InventoryLog {
  id: string
  product_id: string
  type: string
  qty: number
  created_at: string
  return_reason?: string | null
  damage_type?: string | null
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
      // Force refresh to get all log types including RETURN and DAMAGE
      const { data, error } = await supabase
        .from('inventory_logs')
        .select(`
          *,
          product:products(name, sku, color, size)
        `)
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

  // Get return metrics - calculate based on date filter
  const getReturnMetrics = () => {
    const returnLogs = filteredLogs.filter(log => log.type === 'RETURN')
    const totalReturns = returnLogs.reduce((sum, log) => sum + Math.abs(log.qty), 0)
    
    // Breakdown by return reason
    const reasonMap = new Map<string, number>()
    returnLogs.forEach(log => {
      if (log.return_reason) {
        const existing = reasonMap.get(log.return_reason) || 0
        reasonMap.set(log.return_reason, existing + Math.abs(log.qty))
      }
    })
    
    const reasonBreakdown = Array.from(reasonMap.entries())
      .map(([reason, qty]) => ({ reason, qty, label: getReturnReasonLabel(reason) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
    
    return { totalReturns, reasonBreakdown }
  }

  // Get damage metrics
  const getDamageMetrics = () => {
    const damageLogs = filteredLogs.filter(log => log.type === 'DAMAGE')
    const totalDamages = damageLogs.reduce((sum, log) => sum + Math.abs(log.qty), 0)
    
    // Breakdown by damage type
    const typeMap = new Map<string, number>()
    damageLogs.forEach(log => {
      if (log.damage_type) {
        const existing = typeMap.get(log.damage_type) || 0
        typeMap.set(log.damage_type, existing + Math.abs(log.qty))
      }
    })
    
    const typeBreakdown = Array.from(typeMap.entries())
      .map(([type, qty]) => ({ type, qty, label: getDamageTypeLabel(type) }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5)
    
    return { totalDamages, typeBreakdown }
  }

  // Get sales trend data for line chart (last 7 days)
  const getSalesTrend = () => {
    const trendMap = new Map<string, number>()
    const today = new Date()
    
    // Initialize last 7 days with 0
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today)
      date.setDate(date.getDate() - i)
      date.setHours(0, 0, 0, 0)
      const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })
      trendMap.set(dateStr, 0)
    }

    // Fill with actual data
    filteredLogs.forEach(log => {
      const logDate = new Date(log.created_at)
      logDate.setHours(0, 0, 0, 0)
      const dateStr = logDate.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit' })
      const existing = trendMap.get(dateStr) || 0
      trendMap.set(dateStr, existing + Math.abs(log.qty))
    })

    return Array.from(trendMap.entries()).map(([date, qty]) => ({
      date,
      sales: qty
    }))
  }

  const topProducts = getTopProducts()
  const colorBreakdown = getColorBreakdown()
  const sizeBreakdown = getSizeBreakdown()
  const salesTrend = getSalesTrend()
  const returnMetrics = getReturnMetrics()
  const damageMetrics = getDamageMetrics()

  // Colors for pie chart
  const COLORS = ['#0f766e', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#10b981', '#f97316', '#14b8a6', '#8b5cf6']

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
    
    // Return Metrics
    if (returnMetrics.totalReturns > 0) {
      startY = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(12)
      doc.text('Metrik Retur', 14, startY)
      
      const returnData = [
        ['Total Retur', returnMetrics.totalReturns.toString()]
      ]
      
      autoTable(doc, {
        startY: startY + 6,
        head: [['Metrik', 'Nilai']],
        body: returnData,
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: 255,
          fontStyle: 'bold'
        }
      })
      
      // Return Reason Breakdown
      if (returnMetrics.reasonBreakdown.length > 0) {
        startY = (doc as any).lastAutoTable.finalY + 15
        doc.setFontSize(12)
        doc.text('Breakdown Alasan Retur', 14, startY)
        
        const reasonData = returnMetrics.reasonBreakdown.map((item, index) => [
          `${index + 1}`,
          item.label,
          item.qty.toString()
        ])
        
        autoTable(doc, {
          startY: startY + 6,
          head: [['Rank', 'Alasan', 'Unit']],
          body: reasonData,
          styles: {
            fontSize: 8,
            cellPadding: 3
          },
          headStyles: {
            fillColor: [59, 130, 246],
            textColor: 255,
            fontStyle: 'bold'
          }
        })
      }
    }
    
    // Damage Metrics
    if (damageMetrics.totalDamages > 0) {
      startY = (doc as any).lastAutoTable.finalY + 15
      doc.setFontSize(12)
      doc.text('Metrik Kerusakan', 14, startY)
      
      const damageData = [
        ['Total Kerusakan', damageMetrics.totalDamages.toString()]
      ]
      
      autoTable(doc, {
        startY: startY + 6,
        head: [['Metrik', 'Nilai']],
        body: damageData,
        styles: {
          fontSize: 9,
          cellPadding: 3
        },
        headStyles: {
          fillColor: [245, 158, 11],
          textColor: 255,
          fontStyle: 'bold'
        }
      })
      
      // Damage Type Breakdown
      if (damageMetrics.typeBreakdown.length > 0) {
        startY = (doc as any).lastAutoTable.finalY + 15
        doc.setFontSize(12)
        doc.text('Breakdown Jenis Kerusakan', 14, startY)
        
        const typeData = damageMetrics.typeBreakdown.map((item, index) => [
          `${index + 1}`,
          item.label,
          item.qty.toString()
        ])
        
        autoTable(doc, {
          startY: startY + 6,
          head: [['Rank', 'Jenis', 'Unit']],
          body: typeData,
          styles: {
            fontSize: 8,
            cellPadding: 3
          },
          headStyles: {
            fillColor: [245, 158, 11],
            textColor: 255,
            fontStyle: 'bold'
          }
        })
      }
    }
    
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
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
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

        {/* Return & Damage Summary Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <Skeleton className="h-6 w-48 mb-6" />
            <Skeleton className="h-64 w-full" />
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
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-900 dark:text-zinc-100">Filter Tanggal</h3>
          <div className="flex gap-2">
            <button
              onClick={() => {
                cache.delete(CACHE_KEYS.ANALYTICS_LOGS)
                fetchLogs()
              }}
              disabled={loading}
              className="flex items-center px-3 py-2 text-sm bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportToPDF}
              disabled={filteredLogs.length === 0}
              className="flex items-center px-3 py-2 text-sm bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleDateFilter}
              className="px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
            >
              Filter
            </button>
            <button
              onClick={resetFilter}
              className="px-6 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Sales Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
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

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
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

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
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

      {/* Return & Damage Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Retur</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{returnMetrics.totalReturns}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{startDate && endDate ? 'filter tanggal' : 'bulan ini'}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <RotateCcw className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Barang Rusak</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{damageMetrics.totalDamages}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{startDate && endDate ? 'filter tanggal' : 'bulan ini'}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Sales Trend Chart */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Tren Penjualan 7 Hari</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
          </div>
          {salesTrend.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={salesTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis 
                  dataKey="date" 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fill: '#64748b' }}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#0f766e" 
                  strokeWidth={2}
                  dot={{ fill: '#0f766e', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Products Bar Chart */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
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
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topProducts}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis 
                  dataKey="product_name" 
                  stroke="#64748b"
                  fontSize={11}
                  tick={{ fill: '#64748b' }}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value) => [`${value || 0} unit`, 'Penjualan']}
                />
                <Bar dataKey="total_qty" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Color Breakdown Pie Chart */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
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
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={colorBreakdown.map(([color, qty]) => ({ name: color, value: qty }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {colorBreakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value) => [`${value || 0} unit`, 'Penjualan']}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Size Breakdown Bar Chart */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
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
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={sizeBreakdown.map(([size, qty]) => ({ size, qty }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" strokeOpacity={0.5} />
                <XAxis 
                  dataKey="size" 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fill: '#64748b' }}
                />
                <YAxis 
                  stroke="#64748b"
                  fontSize={12}
                  tick={{ fill: '#64748b' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  formatter={(value) => [`${value || 0} unit`, 'Penjualan']}
                />
                <Bar dataKey="qty" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Return & Damage Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Return Reason Breakdown */}
        {returnMetrics.reasonBreakdown.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <RotateCcw className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Breakdown Alasan Retur</h2>
              </div>
              {startDate && endDate && (
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Filter: {startDate} - {endDate}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {returnMetrics.reasonBreakdown.map((item, index) => (
                <div key={item.reason} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">#{index + 1}</span>
                    <span className="text-sm text-slate-900 dark:text-zinc-100">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{item.qty} unit</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Damage Type Breakdown */}
        {damageMetrics.typeBreakdown.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Breakdown Jenis Kerusakan</h2>
              </div>
              {startDate && endDate && (
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  Filter: {startDate} - {endDate}
                </span>
              )}
            </div>
            <div className="space-y-3">
              {damageMetrics.typeBreakdown.map((item, index) => (
                <div key={item.type} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-600 dark:text-zinc-400">#{index + 1}</span>
                    <span className="text-sm text-slate-900 dark:text-zinc-100">{item.label}</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{item.qty} unit</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
