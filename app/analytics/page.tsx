'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { CardSkeleton, Skeleton } from '@/components/skeleton'
import { TrendingUp, Package, Calendar, BarChart3, ArrowUp, Download } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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

  // Get daily sales data for line chart
  const getDailySalesData = () => {
    const dailyMap = new Map<string, number>()
    
    filteredLogs.forEach(log => {
      const date = new Date(log.created_at).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      const existing = dailyMap.get(date) || 0
      dailyMap.set(date, existing + Math.abs(log.qty))
    })

    // Get last 7 days
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const dateStr = date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })
      last7Days.push({
        date: dateStr,
        sales: dailyMap.get(dateStr) || 0
      })
    }

    return last7Days
  }

  // Get data for bar chart (top 10 products)
  const getTop10ProductsData = () => {
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
      .slice(0, 10)
      .map((product, index) => ({
        name: product.product_name.substring(0, 15) + '...',
        sku: product.product_sku,
        qty: product.total_qty
      }))
  }

  // Color data for pie chart
  const getColorChartData = () => {
    const totalSales = filteredLogs.reduce((sum, log) => sum + Math.abs(log.qty), 0)
    return colorBreakdown.map(([color, qty]) => ({
      name: color,
      value: qty,
      percentage: totalSales > 0 ? ((qty / totalSales) * 100).toFixed(1) : '0'
    }))
  }

  // Size data for pie chart
  const getSizeChartData = () => {
    const totalSales = filteredLogs.reduce((sum, log) => sum + Math.abs(log.qty), 0)
    return sizeBreakdown.map(([size, qty]) => ({
      name: size,
      value: qty,
      percentage: totalSales > 0 ? ((qty / totalSales) * 100).toFixed(1) : '0'
    }))
  }

  const dailySalesData = getDailySalesData()
  const top10ProductsData = getTop10ProductsData()
  const colorChartData = getColorChartData()
  const sizeChartData = getSizeChartData()

  // Colors for charts
  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16', '#6366f1', '#14b8a6']

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
        {/* Line Chart - Daily Sales Trend */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Tren Penjualan Harian</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailySalesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" darkStroke="#27272a" />
              <XAxis 
                dataKey="date" 
                stroke="#64748b"
                darkStroke="#a1a1aa"
                fontSize={12}
              />
              <YAxis 
                stroke="#64748b"
                darkStroke="#a1a1aa"
                fontSize={12}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  darkBackgroundColor: '#18181b',
                  border: '1px solid #e2e8f0',
                  darkBorder: '#27272a',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="sales" 
                stroke="#3b82f6" 
                strokeWidth={2}
                name="Unit Terjual"
                dot={{ fill: '#3b82f6', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart - Top 10 Products */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Top 10 Produk Terlaris</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={top10ProductsData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" darkStroke="#27272a" />
              <XAxis 
                type="number" 
                stroke="#64748b"
                darkStroke="#a1a1aa"
                fontSize={12}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100}
                stroke="#64748b"
                darkStroke="#a1a1aa"
                fontSize={11}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#ffffff', 
                  darkBackgroundColor: '#18181b',
                  border: '1px solid #e2e8f0',
                  darkBorder: '#27272a',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="qty" fill="#10b981" name="Unit Terjual" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart - Color Breakdown */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ArrowUp className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Distribusi Warna</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
          </div>
          {colorChartData.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={colorChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {colorChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    darkBackgroundColor: '#18181b',
                    border: '1px solid #e2e8f0',
                    darkBorder: '#27272a',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie Chart - Size Breakdown */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Distribusi Ukuran</h2>
            </div>
            {startDate && endDate && (
              <span className="text-xs text-slate-500 dark:text-zinc-400">
                Filter: {startDate} - {endDate}
              </span>
            )}
          </div>
          {sizeChartData.length === 0 ? (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada data</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sizeChartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }) => `${name}: ${percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sizeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#ffffff', 
                    darkBackgroundColor: '#18181b',
                    border: '1px solid #e2e8f0',
                    darkBorder: '#27272a',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
