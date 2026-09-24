'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { Skeleton } from '@/components/skeleton'
import { TrendingUp, TrendingDown, AlertTriangle, Package, Calendar, BarChart3, RefreshCw, Filter, ArrowUp, ArrowDown } from 'lucide-react'

interface ForecastData {
  product: Product
  avgDailySales: number
  totalSales: number
  daysWithSales: number
  forecast7Days: number
  forecast30Days: number
  currentStock: number
  stockAfter7Days: number
  stockAfter30Days: number
  urgency: 'high' | 'medium' | 'low'
  recommendation: string
}

type ForecastPeriod = '7' | '30' | '90'

export default function Forecasting() {
  const [forecasts, setForecasts] = useState<ForecastData[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<ForecastPeriod>('30')
  const [sortBy, setSortBy] = useState<'urgency' | 'sales' | 'name'>('urgency')
  const { showToast } = useToast()

  useEffect(() => {
    fetchForecasts()
  }, [period])

  const fetchForecasts = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Get all products
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (productsError) throw productsError

      const productsList = products || []
      const forecastData: ForecastData[] = []

      // Calculate days in period
      const daysInPeriod = parseInt(period)
      const startDate = new Date()
      startDate.setDate(startDate.getDate() - daysInPeriod)

      // Process each product
      for (const product of productsList) {
        // Get ONLY OUTBOUND_PACKING logs (scan data) for this product
        const { data: logs, error: logsError } = await supabase
          .from('inventory_logs')
          .select('qty, created_at')
          .eq('product_id', product.id)
          .eq('type', 'OUTBOUND_PACKING') // Only scan data
          .gte('created_at', startDate.toISOString())
          .order('created_at', { ascending: true })

        if (logsError) throw logsError

        const scanLogs = logs || []
        const totalSales = scanLogs.reduce((sum, log) => sum + Math.abs(log.qty), 0)
        const daysWithSales = new Set(scanLogs.map(log => 
          new Date(log.created_at).toDateString()
        )).size

        // Calculate average daily sales
        const avgDailySales = daysWithSales > 0 ? totalSales / daysWithSales : 0

        // Calculate forecasts
        const forecast7Days = Math.round(avgDailySales * 7)
        const forecast30Days = Math.round(avgDailySales * 30)

        // Calculate stock after forecast period
        const stockAfter7Days = product.stock - forecast7Days
        const stockAfter30Days = product.stock - forecast30Days

        // Determine urgency based on threshold
        const threshold = product.stock_threshold || 40
        let urgency: 'high' | 'medium' | 'low' = 'low'
        let recommendation = 'Stok aman'

        if (stockAfter7Days <= threshold) {
          urgency = 'high'
          recommendation = `Restock segera! Stok akan habis dalam ${Math.ceil(product.stock / avgDailySales)} hari`
        } else if (stockAfter30Days <= threshold) {
          urgency = 'medium'
          recommendation = `Perlu restock dalam 30 hari. Prediksi habis dalam ${Math.ceil(product.stock / avgDailySales)} hari`
        } else if (avgDailySales > 0 && product.stock <= threshold * 2) {
          urgency = 'medium'
          recommendation = 'Stok menipis, pertimbangkan restock'
        }

        forecastData.push({
          product,
          avgDailySales: Math.round(avgDailySales * 10) / 10,
          totalSales,
          daysWithSales,
          forecast7Days,
          forecast30Days,
          currentStock: product.stock,
          stockAfter7Days,
          stockAfter30Days,
          urgency,
          recommendation
        })
      }

      // Sort forecasts
      const sortedForecasts = [...forecastData].sort((a, b) => {
        if (sortBy === 'urgency') {
          const urgencyOrder = { high: 0, medium: 1, low: 2 }
          return urgencyOrder[a.urgency] - urgencyOrder[b.urgency]
        } else if (sortBy === 'sales') {
          return b.avgDailySales - a.avgDailySales
        } else {
          return a.product.name.localeCompare(b.product.name)
        }
      })

      setForecasts(sortedForecasts)
    } catch (error) {
      console.error('Error fetching forecasts:', error)
      showToast('error', 'Gagal memuat data forecasting')
    } finally {
      setLoading(false)
    }
  }

  const getUrgencyColor = (urgency: 'high' | 'medium' | 'low') => {
    switch (urgency) {
      case 'high':
        return 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
      case 'medium':
        return 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
      case 'low':
        return 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
    }
  }

  const getUrgencyIcon = (urgency: 'high' | 'medium' | 'low') => {
    switch (urgency) {
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <TrendingDown className="h-4 w-4" />
      case 'low':
        return <TrendingUp className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-64 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  const highUrgencyCount = forecasts.filter(f => f.urgency === 'high').length
  const mediumUrgencyCount = forecasts.filter(f => f.urgency === 'medium').length

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Forecasting Stok</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-300 text-sm sm:text-base">
          Prediksi kebutuhan stok berdasarkan data scan SKU (OUTBOUND_PACKING) saja
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Produk Perlu Restock</p>
              <p className="text-2xl sm:text-4xl font-bold text-red-600 dark:text-red-400 mt-1 sm:mt-2">{highUrgencyCount}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-red-100 dark:bg-red-950 flex items-center justify-center flex-shrink-0 ml-2">
              <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Perlu Perhatian</p>
              <p className="text-2xl sm:text-4xl font-bold text-amber-600 dark:text-amber-400 mt-1 sm:mt-2">{mediumUrgencyCount}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0 ml-2">
              <TrendingDown className="h-5 w-5 sm:h-6 sm:w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-medium text-slate-500 dark:text-zinc-400">Total Produk</p>
              <p className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-1 sm:mt-2">{forecasts.length}</p>
            </div>
            <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 ml-2">
              <Package className="h-5 w-5 sm:h-6 sm:w-6 text-slate-600 dark:text-zinc-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-4 sm:p-6 mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Filter</h2>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as ForecastPeriod)}
                className="px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
              >
                <option value="7">7 Hari Terakhir</option>
                <option value="30">30 Hari Terakhir</option>
                <option value="90">90 Hari Terakhir</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-slate-600 dark:text-zinc-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'urgency' | 'sales' | 'name')}
                className="px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
              >
                <option value="urgency">Urutkan Urgensi</option>
                <option value="sales">Urutkan Penjualan</option>
                <option value="name">Urutkan Nama</option>
              </select>
            </div>
            <button
              onClick={fetchForecasts}
              disabled={loading}
              className="flex items-center px-3 py-2 text-sm bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Forecast Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {forecasts.map((forecast) => (
          <div key={forecast.product.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-4 sm:p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 dark:text-zinc-100 truncate">
                  {forecast.product.name}
                </h3>
                <p className="text-sm text-slate-500 dark:text-zinc-400">
                  {forecast.product.sku} - {forecast.product.color} - {forecast.product.size}
                </p>
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(forecast.urgency)}`}>
                {getUrgencyIcon(forecast.urgency)}
                <span className="ml-1 capitalize">{forecast.urgency}</span>
              </span>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-zinc-400">Stok Saat Ini</span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100">{forecast.currentStock}</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-zinc-400">Rata-rata Harian</span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100">{forecast.avgDailySales}/hari</span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-zinc-400">Total Penjualan ({period} hari)</span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100">{forecast.totalSales}</span>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-700 pt-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Prediksi 7 Hari</span>
                  <span className="font-semibold text-slate-900 dark:text-zinc-100">
                    {forecast.forecast7Days} unit
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Sisa Stok 7 Hari</span>
                  <span className={`font-semibold ${forecast.stockAfter7Days <= 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-zinc-100'}`}>
                    {forecast.stockAfter7Days}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-zinc-400">Prediksi 30 Hari</span>
                <span className="font-semibold text-slate-900 dark:text-zinc-100">
                  {forecast.forecast30Days} unit
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-zinc-400">Sisa Stok 30 Hari</span>
                <span className={`font-semibold ${forecast.stockAfter30Days <= 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-zinc-100'}`}>
                  {forecast.stockAfter30Days}
                </span>
              </div>
            </div>

            <div className="mt-4 p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
              <p className="text-xs text-slate-600 dark:text-zinc-300">
                {forecast.recommendation}
              </p>
            </div>
          </div>
        ))}
      </div>

      {forecasts.length === 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-12 text-center">
          <BarChart3 className="h-12 w-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-zinc-400">Belum ada data scan SKU untuk forecasting</p>
        </div>
      )}
    </div>
  )
}