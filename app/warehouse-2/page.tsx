'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { CardSkeleton, Skeleton } from '@/components/skeleton'
import { Warehouse, Plus, Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, Package, ArrowRight, ArrowLeft, AlertTriangle } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  color: string
  size: string
  stock: number
}

interface Warehouse2Stock {
  id: string
  product_id: string
  quantity: number
  minimum_stock: number
  last_updated: string
  product: Product
}

interface WarehouseTransfer {
  id: string
  product_id: string
  from_warehouse: string
  to_warehouse: string
  quantity: number
  notes: string | null
  status: string
  created_at: string
  product: Product
}

export default function Warehouse2() {
  const [stocks, setStocks] = useState<Warehouse2Stock[]>([])
  const [transfers, setTransfers] = useState<WarehouseTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'sku' | 'name' | 'quantity'>('sku')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'Gudang Utama' | 'Gudang 2'>('all')
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [transferDirection, setTransferDirection] = useState<'to-warehouse-2' | 'to-main'>('to-warehouse-2')
  const [transferQuantity, setTransferQuantity] = useState('')
  const [transferNotes, setTransferNotes] = useState('')
  const { showToast } = useToast()

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Fetch warehouse 2 stocks
      const { data: stocksData, error: stocksError } = await supabase
        .from('warehouse_2_stock')
        .select('*, product:products(*)')
        .order('last_updated', { ascending: false })

      if (stocksError) throw stocksError
      setStocks(stocksData || [])

      // Fetch recent transfers
      const { data: transfersData, error: transfersError } = await supabase
        .from('warehouse_transfers')
        .select('*, product:products(*)')
        .order('created_at', { ascending: false })
        .limit(20)

      if (transfersError) throw transfersError
      setTransfers(transfersData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('error', 'Gagal memuat data Gudang 2')
    } finally {
      setLoading(false)
    }
  }

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedProduct || !transferQuantity) {
      showToast('error', 'Pilih produk dan masukkan jumlah')
      return
    }

    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    const qty = parseInt(transferQuantity)
    if (qty <= 0) {
      showToast('error', 'Jumlah harus lebih dari 0')
      return
    }

    try {
      const fromWarehouse = transferDirection === 'to-warehouse-2' ? 'Gudang Utama' : 'Gudang 2'
      const toWarehouse = transferDirection === 'to-warehouse-2' ? 'Gudang 2' : 'Gudang Utama'

      // Check if source has enough stock
      if (transferDirection === 'to-warehouse-2') {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', selectedProduct.id)
          .single()

        if (!product || product.stock < qty) {
          showToast('error', 'Stok di Gudang Utama tidak mencukupi')
          return
        }
      } else {
        const warehouseStock = stocks.find(s => s.product_id === selectedProduct.id)
        if (!warehouseStock || warehouseStock.quantity < qty) {
          showToast('error', 'Stok di Gudang 2 tidak mencukupi')
          return
        }
      }

      // Create transfer record
      const { error: transferError } = await supabase
        .from('warehouse_transfers')
        .insert({
          product_id: selectedProduct.id,
          from_warehouse: fromWarehouse,
          to_warehouse: toWarehouse,
          quantity: qty,
          notes: transferNotes || null,
          status: 'Completed'
        })

      if (transferError) throw transferError

      // Update source warehouse stock
      if (transferDirection === 'to-warehouse-2') {
        await supabase
          .from('products')
          .update({ stock: supabase.raw('stock - ' + qty) })
          .eq('id', selectedProduct.id)
      } else {
        await supabase
          .from('warehouse_2_stock')
          .update({ quantity: supabase.raw('quantity - ' + qty) })
          .eq('product_id', selectedProduct.id)
      }

      // Update destination warehouse stock
      if (transferDirection === 'to-warehouse-2') {
        const existingStock = stocks.find(s => s.product_id === selectedProduct.id)
        if (existingStock) {
          await supabase
            .from('warehouse_2_stock')
            .update({ 
              quantity: supabase.raw('quantity + ' + qty),
              last_updated: new Date().toISOString()
            })
            .eq('product_id', selectedProduct.id)
        } else {
          await supabase
            .from('warehouse_2_stock')
            .insert({
              product_id: selectedProduct.id,
              quantity: qty,
              minimum_stock: 5,
              last_updated: new Date().toISOString()
            })
        }
      } else {
        await supabase
          .from('products')
          .update({ stock: supabase.raw('stock + ' + qty) })
          .eq('id', selectedProduct.id)
      }

      // Log the transfer in inventory_logs
      await supabase
        .from('inventory_logs')
        .insert({
          product_id: selectedProduct.id,
          type: 'WAREHOUSE_TRANSFER',
          qty: transferDirection === 'to-warehouse-2' ? -qty : qty,
          notes: `Transfer dari ${fromWarehouse} ke ${toWarehouse}`
        })

      showToast('success', 'Transfer stok berhasil')
      setShowTransferModal(false)
      setSelectedProduct(null)
      setTransferQuantity('')
      setTransferNotes('')
      fetchData()
    } catch (error) {
      console.error('Error transferring stock:', error)
      showToast('error', 'Gagal melakukan transfer stok')
    }
  }

  const filteredStocks = stocks.filter(stock => {
    const product = stock.product
    if (!product) return false
    
    const matchesSearch = 
      product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.color.toLowerCase().includes(searchQuery.toLowerCase())
    
    return matchesSearch
  })

  const sortedStocks = [...filteredStocks].sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'sku':
        comparison = a.product.sku.localeCompare(b.product.sku)
        break
      case 'name':
        comparison = a.product.name.localeCompare(b.product.name)
        break
      case 'quantity':
        comparison = a.quantity - b.quantity
        break
    }
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      case 'In Transit': return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      case 'Pending': return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
      case 'Cancelled': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
  }

  const isLowStock = (stock: Warehouse2Stock) => {
    return stock.quantity <= stock.minimum_stock
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <Skeleton className="h-6 w-32 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Gudang 2</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Pemantauan stok dan transfer antar gudang</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Produk</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{stocks.length}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
              <Package className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Low Stock Alert</p>
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-2">
                {stocks.filter(s => isLowStock(s)).length}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-red-50 dark:bg-red-950 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Stok</p>
              <p className="text-3xl font-bold text-slate-900 dark:text-zinc-100 mt-2">
                {stocks.reduce((sum, s) => sum + s.quantity, 0)}
              </p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <Warehouse className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan SKU, nama, atau warna..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={() => setShowTransferModal(true)}
            className="flex items-center px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors whitespace-nowrap"
          >
            <Plus className="h-4 w-4 mr-2" />
            Transfer Stok
          </button>
        </div>
      </div>

      {/* Data Sheet */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-zinc-800 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-zinc-100">Daftar Stok Gudang 2</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setSortBy('sku')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                sortBy === 'sku' 
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100' 
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              SKU {sortBy === 'sku' && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
            </button>
            <button
              onClick={() => setSortBy('name')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                sortBy === 'name' 
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100' 
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              Nama {sortBy === 'name' && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
            </button>
            <button
              onClick={() => setSortBy('quantity')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${
                sortBy === 'quantity' 
                  ? 'bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100' 
                  : 'text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
              }`}
            >
              Stok {sortBy === 'quantity' && (sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 inline ml-1" /> : <ArrowDown className="h-3 w-3 inline ml-1" />)}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">SKU</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Nama Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Warna</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Ukuran</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Stok</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">Terakhir Update</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {sortedStocks.map((stock) => (
                <tr key={stock.id} className={`hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors ${isLowStock(stock) ? 'bg-red-50/50 dark:bg-red-950/20' : ''}`}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-zinc-100">
                    {stock.product.sku}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-zinc-300">
                    {stock.product.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-zinc-300">
                    {stock.product.color}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 dark:text-zinc-300">
                    {stock.product.size}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`text-sm font-medium ${isLowStock(stock) ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-zinc-100'}`}>
                      {stock.quantity}
                    </span>
                    {isLowStock(stock) && (
                      <span className="ml-2 text-xs text-red-600 dark:text-red-400">
                        (Min: {stock.minimum_stock})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-zinc-400">
                    {new Date(stock.last_updated).toLocaleDateString('id-ID')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sortedStocks.length === 0 && (
          <div className="p-12 text-center">
            <Package className="h-16 w-16 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-zinc-400">
              {searchQuery ? 'Tidak ada hasil pencarian' : 'Belum ada stok di Gudang 2'}
            </p>
          </div>
        )}
      </div>

      {/* Recent Transfers */}
      <div className="mt-8 bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
        <h2 className="font-semibold text-slate-900 dark:text-zinc-100 mb-4">Transfer Terakhir</h2>
        <div className="space-y-3">
          {transfers.slice(0, 5).map((transfer) => (
            <div key={transfer.id} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl">
              <div className="flex items-center gap-4">
                <div className="flex items-center text-slate-600 dark:text-zinc-400">
                  {transfer.from_warehouse === 'Gudang Utama' ? (
                    <>
                      <span>{transfer.from_warehouse}</span>
                      <ArrowRight className="h-4 w-4 mx-2" />
                      <span>{transfer.to_warehouse}</span>
                    </>
                  ) : (
                    <>
                      <span>{transfer.from_warehouse}</span>
                      <ArrowLeft className="h-4 w-4 mx-2" />
                      <span>{transfer.to_warehouse}</span>
                    </>
                  )}
                </div>
                <div className="text-sm text-slate-700 dark:text-zinc-300">
                  {transfer.product.name} ({transfer.product.sku})
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                  {transfer.quantity} pcs
                </span>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(transfer.status)}`}>
                  {transfer.status}
                </span>
                <span className="text-xs text-slate-500 dark:text-zinc-400">
                  {new Date(transfer.created_at).toLocaleDateString('id-ID')}
                </span>
              </div>
            </div>
          ))}
          {transfers.length === 0 && (
            <p className="text-slate-500 dark:text-zinc-400 text-center py-8">Belum ada transfer</p>
          )}
        </div>
      </div>

      {/* Transfer Modal */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl max-w-md w-full p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-6">Transfer Stok</h2>
            <form onSubmit={handleTransfer} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Arah Transfer
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setTransferDirection('to-warehouse-2')}
                    className={`flex-1 flex items-center justify-center px-4 py-3 rounded-xl transition-colors ${
                      transferDirection === 'to-warehouse-2'
                        ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    Gudang Utama <ArrowRight className="h-4 w-4 mx-2" /> Gudang 2
                  </button>
                  <button
                    type="button"
                    onClick={() => setTransferDirection('to-main')}
                    className={`flex-1 flex items-center justify-center px-4 py-3 rounded-xl transition-colors ${
                      transferDirection === 'to-main'
                        ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                    }`}
                  >
                    Gudang 2 <ArrowLeft className="h-4 w-4 mx-2" /> Gudang Utama
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Produk
                </label>
                <select
                  required
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const product = stocks.find(s => s.product_id === e.target.value)?.product
                    setSelectedProduct(product || null)
                  }}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                >
                  <option value="">Pilih produk</option>
                  {stocks.map((stock) => (
                    <option key={stock.product_id} value={stock.product_id}>
                      {stock.product.sku} - {stock.product.name} ({stock.product.color} / {stock.product.size})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Jumlah
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all resize-none"
                  rows={3}
                  placeholder="Catatan transfer..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Transfer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowTransferModal(false)
                    setSelectedProduct(null)
                    setTransferQuantity('')
                    setTransferNotes('')
                  }}
                  className="flex-1 px-6 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Batal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
