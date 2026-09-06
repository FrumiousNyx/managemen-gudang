'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Clock, ArrowDown, ArrowUp, Package, Filter } from 'lucide-react'

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
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [filter])

  const fetchLogs = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)

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
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">Riwayat Inventaris</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400">Lihat semua pergerakan stok barang masuk dan keluar</p>
      </div>

      {/* Filter */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Filter</h2>
          </div>
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
          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {logs.map((log) => (
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
        )}
      </div>
    </div>
  )
}
