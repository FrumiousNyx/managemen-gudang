'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { Skeleton } from '@/components/skeleton'
import { Clock, ArrowDown, ArrowUp, Package, Filter, ChevronLeft, ChevronRight, Calendar, Trash2, AlertTriangle, Download, RefreshCw, RotateCcw } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getReturnReasonLabel, getDamageTypeLabel } from '@/lib/stock-utils'

interface InventoryLog {
  id: string
  product_id: string
  type: string
  qty: number
  notes: string
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

type FilterType = 'all' | 'inbound' | 'outbound' | 'return' | 'damage'

export default function History() {
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [selectedLogs, setSelectedLogs] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const itemsPerPage = 20
  const { showToast } = useToast()

  useEffect(() => {
    fetchLogs()
    setSelectedLogs(new Set()) // Reset selection when filters change
  }, [filter, startDate, endDate])

  // Auto-refresh every 30 seconds to get latest data
  useEffect(() => {
    const interval = setInterval(() => {
      fetchLogs(true) // Force refresh without cache
    }, 30000)

    return () => clearInterval(interval)
  }, [filter, startDate, endDate])

  const fetchLogs = async (forceRefresh = false) => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)
    setCurrentPage(1) // Reset to page 1 when filters change
    setSelectedLogs(new Set()) // Reset selection when fetching

    try {
      // Create cache key based on filters
      const cacheKey = `${CACHE_KEYS.INVENTORY_LOGS}_${filter}_${startDate}_${endDate}`

      // Only use cache if not forcing refresh
      if (!forceRefresh) {
        const cachedData = cache.get(cacheKey)
        if (cachedData) {
          setLogs(cachedData)
          setLoading(false)
          return
        }
      }

      let query = supabase
        .from('inventory_logs')
        .select(`
          *,
          product:products(name, sku, color, size)
        `)
        .order('created_at', { ascending: false })

      if (filter === 'inbound') {
        query = query.eq('type', 'INBOUND_QC')
      } else if (filter === 'outbound') {
        query = query.eq('type', 'OUTBOUND_PACKING')
      } else if (filter === 'return') {
        query = query.eq('type', 'RETURN')
      } else if (filter === 'damage') {
        query = query.eq('type', 'DAMAGE')
      }

      if (startDate) {
        query = query.gte('created_at', startDate)
      }

      if (endDate) {
        // Add one day to include the end date
        const endDateTime = new Date(endDate)
        endDateTime.setDate(endDateTime.getDate() + 1)
        query = query.lt('created_at', endDateTime.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      const logs = data || []
      setLogs(logs)

      // Cache the results for 1 minute (reduced from 3 minutes for fresher data)
      cache.set(cacheKey, logs, 1 * 60 * 1000)
    } catch (error) {
      console.error('Error fetching logs:', error)
      showToast('error', 'Gagal memuat riwayat')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatShortDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  const groupLogsByDate = (logs: InventoryLog[]) => {
    const grouped: Record<string, InventoryLog[]> = {}
    logs.forEach(log => {
      const dateKey = new Date(log.created_at).toDateString()
      if (!grouped[dateKey]) {
        grouped[dateKey] = []
      }
      grouped[dateKey].push(log)
    })
    return grouped
  }

  const totalPages = Math.ceil(logs.length / itemsPerPage)
  const paginatedLogs = logs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )
  const groupedLogs = groupLogsByDate(paginatedLogs)

  const handleClearHistory = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all logs

      if (error) throw error

      // Clear all inventory logs cache
      cache.clear()
      
      showToast('success', 'Riwayat berhasil dihapus')
      setLogs([])
      setCurrentPage(1)
      setShowClearConfirm(false)
      setSelectedLogs(new Set())
    } catch (error) {
      console.error('Error clearing history:', error)
      showToast('error', 'Gagal menghapus riwayat')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSelected = async () => {
    if (!supabase || selectedLogs.size === 0) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('inventory_logs')
        .delete()
        .in('id', Array.from(selectedLogs))

      if (error) throw error

      // Clear cache
      cache.clear()
      
      showToast('success', `${selectedLogs.size} riwayat berhasil dihapus`)
      
      // Refresh logs
      await fetchLogs(true)
      setSelectedLogs(new Set())
      setShowDeleteConfirm(false)
    } catch (error) {
      console.error('Error deleting selected logs:', error)
      showToast('error', 'Gagal menghapus riwayat yang dipilih')
    } finally {
      setLoading(false)
    }
  }

  const toggleLogSelection = (logId: string) => {
    const newSelected = new Set(selectedLogs)
    if (newSelected.has(logId)) {
      newSelected.delete(logId)
    } else {
      newSelected.add(logId)
    }
    setSelectedLogs(newSelected)
  }

  const toggleSelectAll = () => {
    if (selectedLogs.size === paginatedLogs.length) {
      setSelectedLogs(new Set())
    } else {
      setSelectedLogs(new Set(paginatedLogs.map(log => log.id)))
    }
  }

  const getLogTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      'INBOUND_QC': 'Barang Masuk',
      'OUTBOUND_PACKING': 'Barang Keluar',
      'RETURN': 'Retur',
      'DAMAGE': 'Barang Rusak'
    }
    return labels[type] || type
  }

  const getLogTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      'INBOUND_QC': 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950',
      'OUTBOUND_PACKING': 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950',
      'RETURN': 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950',
      'DAMAGE': 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950'
    }
    return colors[type] || 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950'
  }

  const getLogIcon = (type: string) => {
    const icons: Record<string, React.ReactNode> = {
      'INBOUND_QC': <ArrowDown className="h-4 w-4" />,
      'OUTBOUND_PACKING': <ArrowUp className="h-4 w-4" />,
      'RETURN': <RotateCcw className="h-4 w-4" />,
      'DAMAGE': <AlertTriangle className="h-4 w-4" />
    }
    return icons[type] || <Package className="h-4 w-4" />
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(18)
    doc.text('Riwayat Inventaris', 14, 22)
    
    // Filter info
    doc.setFontSize(10)
    doc.setTextColor(100)
    const filterLabels: Record<FilterType, string> = {
      'all': 'Semua Transaksi',
      'inbound': 'Barang Masuk',
      'outbound': 'Barang Keluar',
      'return': 'Retur',
      'damage': 'Barang Rusak'
    }
    doc.text(`Filter: ${filterLabels[filter]}`, 14, 30)
    
    if (startDate || endDate) {
      const dateRange = startDate && endDate ? 
        `${startDate} - ${endDate}` : 
        startDate || endDate
      doc.text(`Tanggal: ${dateRange}`, 14, 36)
    }
    
    doc.text(`Total: ${logs.length} transaksi`, 14, 42)
    
    // Table
    const tableData = logs.map(log => [
      formatDate(log.created_at),
      getLogTypeLabel(log.type),
      log.product?.name || '-',
      log.product?.sku || '-',
      log.product?.color || '-',
      log.product?.size || '-',
      log.qty > 0 ? `+${log.qty}` : log.qty,
      log.type === 'RETURN' ? (log.return_reason ? getReturnReasonLabel(log.return_reason) : '-') : 
      log.type === 'DAMAGE' ? (log.damage_type ? getDamageTypeLabel(log.damage_type) : '-') : '-',
      log.notes || '-'
    ])
    
    autoTable(doc, {
      startY: 50,
      head: [['Tanggal', 'Tipe', 'Nama Produk', 'SKU', 'Warna', 'Ukuran', 'Qty', 'Alasan/Tipe', 'Catatan']],
      body: tableData,
      styles: {
        fontSize: 8,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 30 },
        1: { cellWidth: 20 },
        2: { cellWidth: 25 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 12 },
        6: { cellWidth: 12 },
        7: { cellWidth: 25 },
        8: { cellWidth: 30 }
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
    
    doc.save(`riwayat-inventaris-${new Date().toISOString().split('T')[0]}.pdf`)
    showToast('success', 'PDF berhasil di-download')
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Riwayat Inventaris</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-300 text-sm sm:text-base">Lihat semua pergerakan stok barang masuk dan keluar</p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-600 dark:text-zinc-300" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Filter</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fetchLogs(true)}
                disabled={loading}
                className="flex items-center px-3 py-2 text-sm bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Refresh data"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={exportToPDF}
                disabled={logs.length === 0}
                className="flex items-center px-3 py-2 text-sm bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4 mr-1" />
                Export PDF
              </button>
              {selectedLogs.size > 0 && (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center px-3 py-2 text-sm bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hapus ({selectedLogs.size})
                </button>
              )}
              <button
                onClick={() => setShowClearConfirm(true)}
                className="flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Bersihkan History
              </button>
            </div>
          </div>
          
          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'all'
                  ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilter('inbound')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'inbound'
                  ? 'bg-emerald-600 dark:bg-emerald-500 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Barang Masuk
            </button>
            <button
              onClick={() => setFilter('outbound')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'outbound'
                  ? 'bg-red-600 dark:bg-red-500 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Barang Keluar
            </button>
            <button
              onClick={() => setFilter('return')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'return'
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Retur
            </button>
            <button
              onClick={() => setFilter('damage')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'damage'
                  ? 'bg-amber-600 dark:bg-amber-500 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Barang Rusak
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-slate-200 dark:border-zinc-700">
            <Calendar className="h-5 w-5 text-slate-600 dark:text-zinc-300 mt-6 sm:mt-0" />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="mt-6 sm:mt-0 px-3 py-2 text-sm text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm">
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="p-6 border-b border-slate-200 dark:border-zinc-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Skeleton className="h-8 w-28 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <Skeleton className="h-4 w-full mt-3" />
                    </div>
                    <div className="text-right">
                      <Skeleton className="h-8 w-16" />
                      <Skeleton className="h-4 w-12 mt-1" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="h-12 w-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-zinc-300">Belum ada riwayat inventaris</p>
          </div>
        ) : (
          <>
            {/* Select All Button */}
            <div className="px-6 py-3 border-b border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedLogs.size === paginatedLogs.length && paginatedLogs.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-zinc-100 focus:ring-slate-900 dark:focus:ring-zinc-100"
                />
                <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                  {selectedLogs.size === paginatedLogs.length && paginatedLogs.length > 0 ? 'Batal Pilih Semua' : 'Pilih Semua'}
                </span>
              </label>
              {selectedLogs.size > 0 && (
                <span className="text-sm text-slate-600 dark:text-zinc-300">
                  {selectedLogs.size} dipilih
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {Object.entries(groupedLogs).map(([dateKey, dateLogs]) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="bg-slate-50 dark:bg-zinc-800 px-6 py-3 border-b border-slate-200 dark:border-zinc-700">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {formatShortDate(dateLogs[0].created_at)}
                    </h3>
                  </div>
                  
                  {/* Logs for this date */}
                  {dateLogs.map((log) => (
                    <div key={log.id} className={`p-6 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors ${selectedLogs.has(log.id) ? 'bg-blue-50 dark:bg-blue-950' : ''}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selectedLogs.has(log.id)}
                            onChange={() => toggleLogSelection(log.id)}
                            className="mt-1 w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-slate-900 dark:text-zinc-100 focus:ring-slate-900 dark:focus:ring-zinc-100"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLogTypeColor(log.type)}`}>
                                {getLogIcon(log.type)}
                                <span className="ml-1">{getLogTypeLabel(log.type)}</span>
                              </span>
                              <span className="text-sm text-slate-500 dark:text-zinc-300">{formatDate(log.created_at)}</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                              <div>
                                <span className="text-slate-500 dark:text-zinc-300">Nama:</span>
                                <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.name || '-'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-zinc-300">SKU:</span>
                                <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.sku || '-'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-zinc-300">Warna:</span>
                                <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.color || '-'}</span>
                              </div>
                              <div>
                                <span className="text-slate-500 dark:text-zinc-300">Ukuran:</span>
                                <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.size || '-'}</span>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                              {(log.type === 'RETURN' || log.type === 'DAMAGE') && (
                                <div>
                                  <span className="text-slate-500 dark:text-zinc-300">Alasan/Tipe:</span>
                                  <span className="ml-2 text-slate-900 dark:text-zinc-100">
                                    {log.type === 'RETURN' 
                                      ? (log.return_reason ? getReturnReasonLabel(log.return_reason) : '-')
                                      : (log.damage_type ? getDamageTypeLabel(log.damage_type) : '-')
                                    }
                                  </span>
                                </div>
                              )}
                              <div>
                                <span className="text-slate-500 dark:text-zinc-300">Catatan:</span>
                                <span className="ml-2 text-slate-900 dark:text-zinc-100">{log.notes || '-'}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className={`text-2xl font-bold ${log.qty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {log.qty > 0 ? '+' : ''}{log.qty}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-zinc-300">unit</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-zinc-700 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-slate-600 dark:text-zinc-300 text-center sm:text-left">
                  Halaman {currentPage} dari {totalPages} ({logs.length} total)
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-1 sm:flex-none justify-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Sebelumnya</span>
                    <span className="sm:hidden">Prev</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-1 sm:flex-none justify-center"
                  >
                    <span className="hidden sm:inline">Selanjutnya</span>
                    <span className="sm:hidden">Next</span>
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Clear History Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Hapus Riwayat?
              </h3>
            </div>
            <p className="text-slate-600 dark:text-zinc-300 mb-6">
              Apakah Anda yakin ingin menghapus semua riwayat transaksi? Data stok produk tidak akan terpengaruh.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleClearHistory}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-500 text-white font-medium rounded-xl hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Selected Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-700 shadow-sm p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Hapus {selectedLogs.size} Riwayat?
              </h3>
            </div>
            <p className="text-slate-600 dark:text-zinc-300 mb-6">
              Apakah Anda yakin ingin menghapus {selectedLogs.size} riwayat yang dipilih? Data stok produk tidak akan terpengaruh.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSelected}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 dark:bg-red-500 text-white font-medium rounded-xl hover:bg-red-700 dark:hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {loading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
