'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { StaffGuard } from '@/components/admin-guard'
import { Skeleton } from '@/components/skeleton'
import { RotateCcw, AlertTriangle, Filter, Calendar, Download, TrendingUp, Package } from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getReturnReasonLabel, getDamageTypeLabel, getReturnReasonOptions, getDamageTypeOptions } from '@/lib/stock-utils'

interface InventoryLog {
  id: string
  product_id: string
  type: 'RETURN' | 'DAMAGE'
  qty: number
  notes: string
  return_reason?: string | null
  damage_type?: string | null
  created_at: string
  product: {
    name: string
    sku: string
    color: string
    size: string
  }
}

type FilterType = 'all' | 'return' | 'damage'

export default function ReturnsPage() {
  const [logs, setLogs] = useState<InventoryLog[]>([])
  const [filter, setFilter] = useState<FilterType>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    fetchLogs()
  }, [filter, startDate, endDate])

  const fetchLogs = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      setLoading(false)
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
        .in('type', ['RETURN', 'DAMAGE'])
        .order('created_at', { ascending: false })

      if (filter === 'return') {
        query = query.eq('type', 'RETURN')
      } else if (filter === 'damage') {
        query = query.eq('type', 'DAMAGE')
      }

      if (startDate) {
        query = query.gte('created_at', startDate)
      }

      if (endDate) {
        const endDateTime = new Date(endDate)
        endDateTime.setDate(endDateTime.getDate() + 1)
        query = query.lt('created_at', endDateTime.toISOString())
      }

      const { data, error } = await query

      if (error) throw error

      const logs = data || []
      setLogs(logs)
    } catch (error) {
      console.error('Error fetching logs:', error)
      showToast('error', 'Gagal memuat data retur/rusak')
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

  const handleDateFilter = () => {
    fetchLogs()
  }

  const resetFilter = () => {
    setStartDate('')
    setEndDate('')
    fetchLogs()
  }

  // Calculate metrics
  const totalReturns = logs.filter(l => l.type === 'RETURN').length
  const totalDamages = logs.filter(l => l.type === 'DAMAGE').length
  const totalReturnQty = logs.filter(l => l.type === 'RETURN').reduce((sum, l) => sum + Math.abs(l.qty), 0)
  const totalDamageQty = logs.filter(l => l.type === 'DAMAGE').reduce((sum, l) => sum + Math.abs(l.qty), 0)

  // Get breakdown by return reason
  const getReturnReasonBreakdown = () => {
    const reasonMap = new Map<string, number>()
    logs.filter(l => l.type === 'RETURN' && l.return_reason).forEach(log => {
      const existing = reasonMap.get(log.return_reason!) || 0
      reasonMap.set(log.return_reason!, existing + Math.abs(log.qty))
    })
    return Array.from(reasonMap.entries())
      .map(([reason, qty]) => ({ reason, qty, label: getReturnReasonLabel(reason) }))
      .sort((a, b) => b.qty - a.qty)
  }

  // Get breakdown by damage type
  const getDamageTypeBreakdown = () => {
    const typeMap = new Map<string, number>()
    logs.filter(l => l.type === 'DAMAGE' && l.damage_type).forEach(log => {
      const existing = typeMap.get(log.damage_type!) || 0
      typeMap.set(log.damage_type!, existing + Math.abs(log.qty))
    })
    return Array.from(typeMap.entries())
      .map(([type, qty]) => ({ type, qty, label: getDamageTypeLabel(type) }))
      .sort((a, b) => b.qty - a.qty)
  }

  const returnReasonBreakdown = getReturnReasonBreakdown()
  const damageTypeBreakdown = getDamageTypeBreakdown()
  const groupedLogs = groupLogsByDate(logs)

  const exportToPDF = () => {
    const doc = new jsPDF()
    
    // Title
    doc.setFontSize(18)
    doc.text('Laporan Retur & Barang Rusak', 14, 22)
    
    // Filter info
    doc.setFontSize(10)
    doc.setTextColor(100)
    const filterText = filter === 'all' ? 'Semua Transaksi' : 
                       filter === 'return' ? 'Retur Saja' : 'Barang Rusak Saja'
    doc.text(`Filter: ${filterText}`, 14, 30)
    
    if (startDate || endDate) {
      const dateRange = startDate && endDate ? 
        `${startDate} - ${endDate}` : 
        startDate || endDate
      doc.text(`Tanggal: ${dateRange}`, 14, 36)
    }
    
    doc.text(`Total: ${logs.length} transaksi`, 14, 42)
    
    // Summary
    doc.setFontSize(12)
    doc.setTextColor(0)
    doc.text('Ringkasan', 14, 54)
    
    const summaryData = [
      ['Total Retur', totalReturns.toString()],
      ['Total Barang Rusak', totalDamages.toString()],
      ['Total Unit Retur', totalReturnQty.toString()],
      ['Total Unit Rusak', totalDamageQty.toString()]
    ]
    
    autoTable(doc, {
      startY: 60,
      head: [['Kategori', 'Jumlah']],
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
    
    // Table
    const tableData = logs.map(log => [
      formatDate(log.created_at),
      log.type === 'RETURN' ? 'Retur' : 'Barang Rusak',
      log.product?.name || '-',
      log.product?.sku || '-',
      log.product?.color || '-',
      log.product?.size || '-',
      Math.abs(log.qty).toString(),
      log.type === 'RETURN' ? (log.return_reason ? getReturnReasonLabel(log.return_reason) : '-') : (log.damage_type ? getDamageTypeLabel(log.damage_type) : '-'),
      log.notes || '-'
    ])
    
    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
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
    
    doc.save(`laporan-retur-rusak-${new Date().toISOString().split('T')[0]}.pdf`)
    showToast('success', 'PDF berhasil di-download')
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>

        {/* Metric Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>

        {/* Filter Skeleton */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="flex gap-4">
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 flex-1" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        {/* List Skeleton */}
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-6 border-b border-slate-200 dark:border-zinc-800">
                <Skeleton className="h-6 w-48 mb-3" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <StaffGuard>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Retur & Barang Rusak</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Kelola dan lacak retur serta barang rusak</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Retur</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalReturns}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">transaksi</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <RotateCcw className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Barang Rusak</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalDamages}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">transaksi</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Unit Retur</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalReturnQty}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">unit</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <Package className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Unit Rusak</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalDamageQty}</p>
              <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">unit</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Breakdown Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Return Reason Breakdown */}
        {returnReasonBreakdown.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-4">Breakdown Alasan Retur</h3>
            <div className="space-y-3">
              {returnReasonBreakdown.slice(0, 5).map((item, index) => (
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
        {damageTypeBreakdown.length > 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-4">Breakdown Jenis Kerusakan</h3>
            <div className="space-y-3">
              {damageTypeBreakdown.slice(0, 5).map((item, index) => (
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

      {/* Filter */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Filter</h2>
            </div>
            <button
              onClick={exportToPDF}
              disabled={logs.length === 0}
              className="flex items-center px-3 py-2 text-sm bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 hover:bg-slate-800 dark:hover:bg-zinc-200 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="h-4 w-4 mr-1" />
              Export PDF
            </button>
          </div>
          
          {/* Type Filter */}
          <div className="flex items-center gap-2">
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
                  ? 'bg-red-600 dark:bg-red-500 text-white'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              Barang Rusak
            </button>
          </div>

          {/* Date Range Filter */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
            <Calendar className="h-5 w-5 text-slate-600 dark:text-zinc-400 mt-6 sm:mt-0" />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-1">
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
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
                  className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6 sm:mt-0">
              <button
                onClick={handleDateFilter}
                className="px-6 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
              >
                Filter
              </button>
              {(startDate || endDate) && (
                <button
                  onClick={resetFilter}
                  className="px-6 py-2 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Logs List */}
      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        {logs.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="h-12 w-12 text-slate-400 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-zinc-400">Belum ada data retur atau barang rusak</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-zinc-800">
            {Object.entries(groupedLogs).map(([dateKey, dateLogs]) => (
              <div key={dateKey}>
                {/* Date Header */}
                <div className="bg-slate-50 dark:bg-zinc-800 px-6 py-3 border-b border-slate-200 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-zinc-100">
                    {formatShortDate(dateLogs[0].created_at)}
                  </h3>
                </div>
                
                {/* Logs for this date */}
                {dateLogs.map((log) => (
                  <div key={log.id} className="p-6 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            log.type === 'RETURN'
                              ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950'
                              : 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950'
                          }`}>
                            {log.type === 'RETURN' ? (
                              <RotateCcw className="h-4 w-4 mr-1" />
                            ) : (
                              <AlertTriangle className="h-4 w-4 mr-1" />
                            )}
                            <span className="ml-1">{log.type === 'RETURN' ? 'Retur' : 'Barang Rusak'}</span>
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
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-slate-500 dark:text-zinc-400">Alasan/Tipe:</span>
                            <span className="ml-2 text-slate-900 dark:text-zinc-100">
                              {log.type === 'RETURN' 
                                ? (log.return_reason ? getReturnReasonLabel(log.return_reason) : '-')
                                : (log.damage_type ? getDamageTypeLabel(log.damage_type) : '-')
                              }
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 dark:text-zinc-400">Catatan:</span>
                            <span className="ml-2 text-slate-900 dark:text-zinc-100">{log.notes || '-'}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className={`text-2xl font-bold ${log.type === 'RETURN' ? 'text-blue-600 dark:text-blue-400' : 'text-red-600 dark:text-red-400'}`}>
                          {Math.abs(log.qty)}
                        </div>
                        <div className="text-sm text-slate-500 dark:text-zinc-400">unit</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </StaffGuard>
  )
}
