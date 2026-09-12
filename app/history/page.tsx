'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Clock, ArrowDown, ArrowUp, Package, Filter, ChevronLeft, ChevronRight, Calendar, Trash2, AlertTriangle } from 'lucide-react'

interface InventoryLog {
  id: string
  product_id: string
  type: string
  qty: number
  notes: string
  created_at: string
  product: {
    name: string
    sku: string
    color: string
    size: string
  }
}

type FilterType = 'all' | 'inbound' | 'outbound'

export default function History() {
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const itemsPerPage = 20
  const { showToast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [filter, startDate, endDate])

  const fetchLogs = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)
    setCurrentPage(1) // Reset to page 1 when filters change

    try {
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

      setLogs(data || [])
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

      showToast('success', 'Riwayat berhasil dihapus')
      setLogs([])
      setCurrentPage(1)
      setShowClearConfirm(false)
    } catch (error) {
      console.error('Error clearing history:', error)
      showToast('error', 'Gagal menghapus riwayat')
    } finally {
      setLoading(false)
    }
  }

  const getLogTypeLabel = (type: string) => {
    switch (type) {
      case 'INBOUND_QC':
        return 'Barang Masuk'
      case 'OUTBOUND_PACKING':
        return 'Barang Keluar'
      default:
        return type
    }
  }

  const getLogTypeColor = (type: string) => {
    switch (type) {
      case 'INBOUND_QC':
        return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950'
      case 'OUTBOUND_PACKING':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
      default:
        return 'text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-950'
    }
  }

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'INBOUND_QC':
        return <ArrowDown className="h-4 w-4" />
      case 'OUTBOUND_PACKING':
        return <ArrowUp className="h-4 w-4" />
      default:
        return <Package className="h-4 w-4" />
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Riwayat Inventaris</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Lihat semua pergerakan stok barang masuk dan keluar</p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Filter</h2>
            </div>
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Bersihkan History
            </button>
          </div>
          
          {/* Type Filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'all'
                  ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Semua
            </button>
            <button
              onClick={() => setFilter('inbound')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'inbound'
                  ? 'bg-emerald-600 dark:bg-emerald-500 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Barang Masuk
            </button>
            <button
              onClick={() => setFilter('outbound')}
              className={`px-4 py-2 rounded-xl font-medium transition-all ${
                filter === 'outbound'
                  ? 'bg-red-600 dark:bg-red-500 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Barang Keluar
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
            <Calendar className="h-5 w-5 text-slate-600 dark:text-zinc-400 mt-6 sm:mt-0" />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                />
              </div>
            </div>
            {(startDate || endDate) && (
              <button
                onClick={() => {
                  setStartDate('')
                  setEndDate('')
                }}
                className="mt-6 sm:mt-0 px-3 py-2 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100 transition-colors whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-zinc-700 border-t-slate-900 dark:border-t-zinc-100 mx-auto"></div>
            <p className="mt-4 text-slate-600 dark:text-zinc-400">Memuat riwayat...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center">
            <Clock className="h-12 w-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-zinc-400">Belum ada riwayat inventaris</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-200 dark:divide-zinc-800">
              {Object.entries(groupedLogs).map(([dateKey, dateLogs]) => (
                <div key={dateKey}>
                  {/* Date Header */}
                  <div className="bg-slate-50 dark:bg-zinc-950 px-6 py-3 border-b border-slate-200 dark:border-zinc-800">
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {formatShortDate(dateLogs[0].created_at)}
                    </h3>
                  </div>
                  
                  {/* Logs for this date */}
                  {dateLogs.map((log) => (
                    <div key={log.id} className="p-6 hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getLogTypeColor(log.type)}`}>
                              {getLogIcon(log.type)}
                              <span className="ml-1">{getLogTypeLabel(log.type)}</span>
                            </span>
                            <span className="text-sm text-slate-500 dark:text-zinc-400">{formatDate(log.created_at)}</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                            <div>
                              <span className="text-slate-500 dark:text-zinc-400">Nama:</span>
                              <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.name || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-zinc-400">SKU:</span>
                              <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.sku || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-zinc-400">Warna:</span>
                              <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.color || '-'}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 dark:text-zinc-400">Ukuran:</span>
                              <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{log.product?.size || '-'}</span>
                            </div>
                          </div>
                          <div className="mt-3 text-sm">
                            <span className="text-slate-500 dark:text-zinc-400">Catatan:</span>
                            <span className="ml-2 text-slate-900 dark:text-zinc-100">{log.notes}</span>
                          </div>
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className={`text-2xl font-bold ${log.qty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {log.qty > 0 ? '+' : ''}{log.qty}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-zinc-400">unit</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 sm:px-6 py-4 border-t border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-slate-600 dark:text-zinc-400 text-center sm:text-left">
                  Halaman {currentPage} dari {totalPages} ({logs.length} total)
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="flex items-center px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-1 sm:flex-none justify-center"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Sebelumnya</span>
                    <span className="sm:hidden">Prev</span>
                  </button>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className="flex items-center px-3 py-2 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex-1 sm:flex-none justify-center"
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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">
                Hapus Riwayat?
              </h3>
            </div>
            <p className="text-slate-600 dark:text-zinc-400 mb-6">
              Apakah Anda yakin ingin menghapus semua riwayat transaksi? Data stok produk tidak akan terpengaruh.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 transition-all"
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
    </div>
  )
}
