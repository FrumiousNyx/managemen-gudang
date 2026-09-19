'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { CardSkeleton, Skeleton } from '@/components/skeleton'
import { Layers, Scissors, TrendingUp, AlertTriangle, Package } from 'lucide-react'

interface TraceabilityData {
  raw_fabric: {
    id: string
    batch_code: string
    name: string
    material_type: string
    quantity: number
    unit: string
  }
  productions: {
    id: string
    vendor_name: string
    cut_date: string
    quantity_used: number
    unit: string
    total_pieces: number
    status: string
  }[]
  total_quantity_used: number
  total_pieces_produced: number
  efficiency: number
}

export default function Traceability() {
  const [traceabilityData, setTraceabilityData] = useState<TraceabilityData[]>([])
  const [loading, setLoading] = useState(true)
  const { showToast } = useToast()

  useEffect(() => {
    fetchTraceabilityData()
  }, [])

  const fetchTraceabilityData = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Fetch all raw fabrics with their usage in productions
      const { data: rawFabrics, error: rawFabricsError } = await supabase
        .from('raw_fabric')
        .select('*')
        .order('created_at', { ascending: false })

      if (rawFabricsError) throw rawFabricsError

      // For each raw fabric, fetch productions that used it
      const traceabilityPromises = (rawFabrics || []).map(async (fabric) => {
        const { data: productions, error: productionsError } = await supabase
          .from('vendor_production')
          .select('*, vendor:vendors(name)')
          .eq('raw_fabric_id', fabric.id)
          .order('cut_date', { ascending: false })

        if (productionsError) throw productionsError

        const productionsData = (productions || []).map(p => ({
          id: p.id,
          vendor_name: p.vendor?.name || 'Unknown',
          cut_date: p.cut_date,
          quantity_used: p.raw_fabric_quantity_used || 0,
          unit: p.raw_fabric_unit || fabric.unit,
          total_pieces: p.total_pieces,
          status: p.status
        }))

        const totalQuantityUsed = productionsData.reduce((sum, p) => sum + p.quantity_used, 0)
        const totalPiecesProduced = productionsData.reduce((sum, p) => sum + p.total_pieces, 0)
        
        // Calculate efficiency: pieces per unit of raw fabric
        const efficiency = totalQuantityUsed > 0 ? (totalPiecesProduced / totalQuantityUsed) : 0

        return {
          raw_fabric: fabric,
          productions: productionsData,
          total_quantity_used: totalQuantityUsed,
          total_pieces_produced: totalPiecesProduced,
          efficiency
        }
      })

      const results = await Promise.all(traceabilityPromises)
      setTraceabilityData(results)
    } catch (error) {
      console.error('Error fetching traceability data:', error)
      showToast('error', 'Gagal memuat data traceability')
    } finally {
      setLoading(false)
    }
  }

  const getEfficiencyColor = (efficiency: number) => {
    if (efficiency >= 5) return 'text-emerald-600 dark:text-emerald-400'
    if (efficiency >= 3) return 'text-blue-600 dark:text-blue-400'
    if (efficiency >= 1) return 'text-amber-600 dark:text-amber-400'
    return 'text-red-600 dark:text-red-400'
  }

  const getEfficiencyLabel = (efficiency: number) => {
    if (efficiency >= 5) return 'Sangat Efisien'
    if (efficiency >= 3) return 'Efisien'
    if (efficiency >= 1) return 'Cukup Efisien'
    return 'Kurang Efisien'
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Raw-to-Cut Traceability</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">
          Pelacakan penggunaan kain mentah hingga hasil potongan produk
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Batch Kain</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mt-2">
                {traceabilityData.length}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <Layers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Kain Dipakai</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mt-2">
                {traceabilityData.reduce((sum, d) => sum + d.total_quantity_used, 0).toFixed(1)}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">unit</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <Scissors className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Produk Dibuat</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mt-2">
                {traceabilityData.reduce((sum, d) => sum + d.total_pieces_produced, 0)}
              </p>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">pcs</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
              <Package className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {traceabilityData.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-12 text-center">
          <Layers className="h-16 w-16 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-zinc-400">Belum ada data traceability. Data akan muncul setelah produksi menggunakan kain mentah.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {traceabilityData.map((data) => (
            <div
              key={data.raw_fabric.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6"
            >
              {/* Raw Fabric Header */}
              <div className="flex items-start justify-between mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Layers className="h-5 w-5 text-slate-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-zinc-100">
                      {data.raw_fabric.batch_code} - {data.raw_fabric.name}
                    </h3>
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                      {data.raw_fabric.material_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-zinc-400">
                    <span>Stok Awal: {data.raw_fabric.quantity} {data.raw_fabric.unit}</span>
                    <span>•</span>
                    <span>Dipakai: {data.total_quantity_used.toFixed(1)} {data.raw_fabric.unit}</span>
                    <span>•</span>
                    <span>Sisa: {(data.raw_fabric.quantity - data.total_quantity_used).toFixed(1)} {data.raw_fabric.unit}</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Efisiensi</p>
                  <p className={`text-2xl font-bold ${getEfficiencyColor(data.efficiency)}`}>
                    {data.efficiency.toFixed(2)}
                  </p>
                  <p className={`text-xs ${getEfficiencyColor(data.efficiency)}`}>
                    {getEfficiencyLabel(data.efficiency)}
                  </p>
                </div>
              </div>

              {/* Productions using this fabric */}
              {data.productions.length > 0 ? (
                <div className="border-t border-slate-200 dark:border-zinc-800 pt-4">
                  <h4 className="text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
                    Produksi yang menggunakan batch ini
                  </h4>
                  <div className="space-y-3">
                    {data.productions.map((production) => (
                      <div
                        key={production.id}
                        className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Scissors className="h-4 w-4 text-slate-400" />
                            <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                              {production.vendor_name}
                            </p>
                            <span className="text-xs text-slate-500 dark:text-zinc-400">
                              • {new Date(production.cut_date).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">
                            Status: {production.status}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                            {production.quantity_used} {production.unit}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-zinc-400">
                            → {production.total_pieces} pcs
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="border-t border-slate-200 dark:border-zinc-800 pt-4">
                  <p className="text-sm text-slate-500 dark:text-zinc-400 text-center">
                    Belum ada produksi yang menggunakan batch ini
                  </p>
                </div>
              )}

              {/* Efficiency warning */}
              {data.efficiency < 1 && data.total_quantity_used > 0 && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-950 rounded-xl flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
                  <p className="text-sm text-red-700 dark:text-red-400">
                    Efisiensi rendah: {data.efficiency.toFixed(2)} pcs per {data.raw_fabric.unit}. Perlu review proses produksi.
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
