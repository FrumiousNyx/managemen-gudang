'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Printer, Calendar, Download, Filter } from 'lucide-react'

interface PrintHistory {
  id: string
  product_id: string
  product_name: string
  product_sku: string
  product_color: string
  product_size: string
  quantity: number
  created_at: string
}

export default function PrintHistory() {
  const [history, setHistory] = useState<PrintHistory[]>([])
  const [filteredHistory, setFilteredHistory] = useState<PrintHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    fetchHistory()
  }, [])

  useEffect(() => {
    filterHistory()
  }, [history, startDate, endDate])

  const fetchHistory = async () => {
    try {
      if (!supabase) {
        console.error('Supabase not configured')
        return
      }

      const { data, error } = await supabase
        .from('print_history')
        .select(`
          *,
          products (
            name,
            sku,
            color,
            size
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const formattedHistory = data?.map(log => ({
        ...log,
        product_name: log.products?.name || '',
        product_sku: log.products?.sku || '',
        product_color: log.products?.color || '',
        product_size: log.products?.size || ''
      })) || []

      setHistory(formattedHistory)
    } catch (error) {
      console.error('Error fetching print history:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterHistory = () => {
    let filtered = [...history]

    if (startDate) {
      filtered = filtered.filter(log => new Date(log.created_at) >= new Date(startDate))
    }

    if (endDate) {
      const endDateTime = new Date(endDate)
      endDateTime.setHours(23, 59, 59, 999)
      filtered = filtered.filter(log => new Date(log.created_at) <= endDateTime)
    }

    setFilteredHistory(filtered)
  }

  const exportToCSV = () => {
    const headers = ['Tanggal', 'SKU', 'Produk', 'Warna', 'Ukuran', 'Jumlah']
    const rows = filteredHistory.map(log => [
      new Date(log.created_at).toLocaleString('id-ID'),
      log.product_sku,
      log.product_name,
      log.product_color,
      log.product_size,
      log.quantity
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `print-history-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 dark:border-zinc-100 mx-auto"></div>
          <p className="mt-4 text-slate-600 dark:text-zinc-400">Memuat riwayat cetak...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">Riwayat Cetak Label</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400">Lihat semua riwayat cetak label produk</p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
          <h3 className="font-semibold text-slate-900 dark:text-zinc-100">Filter</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              Tanggal Mulai
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
              Tanggal Akhir
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={exportToCSV}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors font-medium"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Tanggal
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Produk
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Warna
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Ukuran
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Jumlah
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
              {filteredHistory.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors">
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-zinc-100">
                    {log.product_sku}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-900 dark:text-zinc-100">
                    {log.product_name}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                    {log.product_color}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                    {log.product_size}
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {log.quantity}
                  </td>
                </tr>
              ))}
              {filteredHistory.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-zinc-400">
                    Tidak ada riwayat cetak yang cocok dengan filter Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
