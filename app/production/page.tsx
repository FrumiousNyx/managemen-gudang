'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { ProductSearch } from '@/components/product-search'
import { LayoutGrid, Plus, Edit, Trash2, X, Users, Package, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react'

interface ProductionOrder {
  id: string
  vendor_id: string
  product_id: string
  sku: string
  rol_count: number
  output_qty: number
  status: string
  production_date: string
  notes: string | null
  created_at: string
  vendor: {
    name: string
  } | null
  product: {
    name: string
    color: string
    size: string
  } | null
}

interface Vendor {
  id: string
  name: string
  production_days: string[] | null
}

interface Product {
  id: string
  sku: string
  name: string
  color: string
  size: string
}

export default function Production() {
  const [orders, setOrders] = useState<ProductionOrder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<ProductionOrder | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    vendor_id: '',
    sku: '',
    rol_count: '',
    output_qty: '',
    production_date: '',
    notes: ''
  })
  const { showToast } = useToast()

  useEffect(() => {
    fetchOrders()
    fetchVendors()
  }, [])

  const fetchOrders = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('production_orders')
        .select('*, vendor:vendors(name), product:products(name, color, size)')
        .order('production_date', { ascending: false })

      if (error) throw error
      setOrders(data || [])
    } catch (error) {
      console.error('Error fetching production orders:', error)
      showToast('error', 'Gagal memuat data produksi')
    } finally {
      setLoading(false)
    }
  }

  const fetchVendors = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, name, production_days')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error fetching vendors:', error)
    }
  }

  const handleOpenModal = (order?: ProductionOrder) => {
    if (order) {
      setEditingOrder(order)
      setSelectedProduct({
        id: order.product_id,
        sku: order.sku,
        name: order.product?.name || '',
        color: order.product?.color || '',
        size: order.product?.size || ''
      })
      setFormData({
        vendor_id: order.vendor_id,
        sku: order.sku,
        rol_count: order.rol_count.toString(),
        output_qty: order.output_qty.toString(),
        production_date: order.production_date,
        notes: order.notes || ''
      })
    } else {
      setEditingOrder(null)
      setSelectedProduct(null)
      setFormData({
        vendor_id: '',
        sku: '',
        rol_count: '',
        output_qty: '',
        production_date: new Date().toISOString().split('T')[0],
        notes: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingOrder(null)
    setSelectedProduct(null)
    setFormData({
      vendor_id: '',
      sku: '',
      rol_count: '',
      output_qty: '',
      production_date: new Date().toISOString().split('T')[0],
      notes: ''
    })
  }

  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product)
    setFormData({ ...formData, sku: product.sku })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    if (!selectedProduct) {
      showToast('error', 'Silakan pilih produk terlebih dahulu')
      return
    }

    setLoading(true)
    try {
      const payload = {
        vendor_id: formData.vendor_id,
        product_id: selectedProduct.id,
        sku: selectedProduct.sku,
        rol_count: parseInt(formData.rol_count),
        output_qty: parseInt(formData.output_qty),
        production_date: formData.production_date,
        notes: formData.notes || null
      }

      if (editingOrder) {
        const { error } = await supabase
          .from('production_orders')
          .update(payload)
          .eq('id', editingOrder.id)

        if (error) throw error
        showToast('success', 'Order produksi berhasil diperbarui')
      } else {
        const { error } = await supabase
          .from('production_orders')
          .insert([payload])

        if (error) throw error
        showToast('success', 'Order produksi berhasil dibuat')
      }

      handleCloseModal()
      await fetchOrders()
    } catch (error) {
      console.error('Error saving production order:', error)
      showToast('error', 'Gagal menyimpan order produksi')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    if (!confirm('Apakah Anda yakin ingin menghapus order ini?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('production_orders')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('success', 'Order produksi berhasil dihapus')
      await fetchOrders()
    } catch (error) {
      console.error('Error deleting production order:', error)
      showToast('error', 'Gagal menghapus order produksi')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (order: ProductionOrder, newStatus: string) => {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('production_orders')
        .update({ status: newStatus })
        .eq('id', order.id)

      if (error) throw error

      // If completed, create production summary entry
      if (newStatus === 'completed') {
        const { error: summaryError } = await supabase
          .from('production_summary')
          .insert([{
            vendor_id: order.vendor_id,
            product_id: order.product_id,
            sku: order.sku,
            rol_count: order.rol_count,
            output_qty: order.output_qty,
            production_date: order.production_date,
            notes: order.notes
          }])

        if (summaryError) throw summaryError

        // Add stock to products
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: supabase.raw('stock + ' + order.output_qty) })
          .eq('id', order.product_id)

        if (stockError) throw stockError

        // Log the transaction
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert([{
            product_id: order.product_id,
            type: 'INBOUND_QC',
            qty: order.output_qty,
            notes: `Produksi dari vendor ${order.vendor?.name} - ${order.rol_count} rol jadi ${order.output_qty} pcs`
          }])

        if (logError) throw logError
      }

      showToast('success', `Status order diubah menjadi ${newStatus}`)
      await fetchOrders()
    } catch (error) {
      console.error('Error updating order status:', error)
      showToast('error', 'Gagal mengubah status order')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
      case 'in_progress':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      case 'completed':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      case 'cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'in_progress':
        return 'Sedang Diproses'
      case 'completed':
        return 'Selesai'
      case 'cancelled':
        return 'Dibatalkan'
      default:
        return status
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4" />
      case 'in_progress':
        return <Calendar className="h-4 w-4" />
      case 'completed':
        return <CheckCircle className="h-4 w-4" />
      case 'cancelled':
        return <XCircle className="h-4 w-4" />
      default:
        return null
    }
  }

  if (loading && orders.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-zinc-800 rounded w-48"></div>
          <div className="h-12 bg-slate-200 dark:bg-zinc-800 rounded w-full"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-slate-200 dark:bg-zinc-800 rounded"></div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Order Produksi</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Kelola order produksi ke vendor jahit</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Buat Order Produksi
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Vendor</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Produk</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Rol</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Hasil Pcs</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Tanggal</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 dark:text-zinc-400 uppercase tracking-wider">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-zinc-800">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-slate-400" />
                      <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">{order.vendor?.name || '-'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">{order.sku}</div>
                    <div className="text-sm text-slate-500 dark:text-zinc-400">{order.product?.name || '-'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                    {order.rol_count} rol
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-zinc-100">
                    {order.output_qty} pcs
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                    {new Date(order.production_date).toLocaleDateString('id-ID')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(order.status)}`}>
                      {getStatusIcon(order.status)}
                      {getStatusLabel(order.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => handleStatusChange(order, 'in_progress')}
                          className="p-2 text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 transition-colors"
                          title="Mulai Proses"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                      )}
                      {order.status === 'in_progress' && (
                        <button
                          onClick={() => handleStatusChange(order, 'completed')}
                          className="p-2 text-emerald-600 hover:text-emerald-800 dark:hover:text-emerald-400 transition-colors"
                          title="Selesai"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenModal(order)}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                        title="Edit"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(order.id)}
                        className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Hapus"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {orders.length === 0 && !loading && (
          <div className="text-center py-12">
            <LayoutGrid className="h-12 w-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-500 dark:text-zinc-400">Belum ada order produksi</p>
            <button
              onClick={() => handleOpenModal()}
              className="mt-4 text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Buat order pertama
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
                  {editingOrder ? 'Edit Order Produksi' : 'Buat Order Produksi'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Vendor *
                  </label>
                  <select
                    required
                    value={formData.vendor_id}
                    onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  >
                    <option value="">Pilih Vendor</option>
                    {vendors.map((vendor) => (
                      <option key={vendor.id} value={vendor.id}>
                        {vendor.name} {vendor.production_days && vendor.production_days.length > 0 && `(${vendor.production_days.join(', ')})`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Produk (SKU) *
                  </label>
                  <ProductSearch
                    onSelect={handleProductSelect}
                    placeholder="Cari SKU atau nama produk..."
                  />
                  {selectedProduct && (
                    <div className="mt-2 text-sm text-slate-600 dark:text-zinc-400">
                      Dipilih: {selectedProduct.sku} - {selectedProduct.name} ({selectedProduct.color}, {selectedProduct.size})
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Jumlah Rol Kain *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={formData.rol_count}
                    onChange={(e) => setFormData({ ...formData, rol_count: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="Contoh: 3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Hasil Pcs (Manual Input) *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.output_qty}
                    onChange={(e) => setFormData({ ...formData, output_qty: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="Contoh: 148"
                  />
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Input manual hasil pcs setelah produksi selesai
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Tanggal Produksi *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.production_date}
                    onChange={(e) => setFormData({ ...formData, production_date: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Catatan
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all resize-none"
                    placeholder="Catatan tambahan"
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-6 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Menyimpan...' : editingOrder ? 'Simpan' : 'Buat Order'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
