'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Package, Plus, Edit, Trash2, X, Printer, Save } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<Product | null>(null)
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    color: '',
    size: '',
    sku: ''
  })
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    fetchProducts()
  }, [])

  const fetchProducts = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized')
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      showToast('error', 'Gagal memuat produk')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    if (!formData.name || !formData.color || !formData.size || !formData.sku) {
      showToast('error', 'Silakan isi semua kolom')
      return
    }

    setLoading(true)

    try {
      // Check if SKU already exists
      const { data: existingProduct } = await supabase
        .from('products')
        .select('id')
        .eq('sku', formData.sku)
        .single()

      if (existingProduct) {
        showToast('error', 'SKU sudah ada')
        setLoading(false)
        return
      }

      // Insert new product
      const { error } = await supabase
        .from('products')
        .insert({
          name: formData.name,
          color: formData.color,
          size: formData.size,
          sku: formData.sku,
          stock: 0
        })

      if (error) throw error

      showToast('success', 'Produk berhasil ditambahkan')
      setIsModalOpen(false)
      setFormData({ name: '', color: '', size: '', sku: '' })
      await fetchProducts()
    } catch (error) {
      console.error('Error adding product:', error)
      console.error('Error details:', JSON.stringify(error, null, 2))
      showToast('error', `Gagal menambah produk: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus produk ini?')) return

    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)

      if (error) throw error

      showToast('success', 'Produk berhasil dihapus')
      await fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      showToast('error', 'Gagal menghapus produk')
    }
  }

  const handleUpdateStock = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase || !selectedProductForStock) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    const newStock = parseInt(stockValue)
    if (isNaN(newStock) || newStock < 0) {
      showToast('error', 'Stok harus berupa angka positif')
      return
    }

    setLoading(true)

    try {
      const stockDiff = newStock - selectedProductForStock.stock
      
      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', selectedProductForStock.id)

      if (updateError) throw updateError

      // Log to inventory_logs if stock changed
      if (stockDiff !== 0) {
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert({
            product_id: selectedProductForStock.id,
            type: stockDiff > 0 ? 'INBOUND_QC' : 'OUTBOUND_PACKING',
            qty: stockDiff,
            notes: 'Manual stock adjustment via Products page'
          })

        if (logError) throw logError
      }

      showToast('success', 'Stok berhasil diperbarui')
      setIsStockModalOpen(false)
      setSelectedProductForStock(null)
      setStockValue('')
      await fetchProducts()
    } catch (error) {
      console.error('Error updating stock:', error)
      showToast('error', 'Gagal memperbarui stok')
    } finally {
      setLoading(false)
    }
  }

  const getStockStatus = (stock: number) => {
    if (stock === 0) return { label: 'Habis', color: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200 dark:border-red-900' }
    if (stock < 10) return { label: 'Menipis', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200 dark:border-amber-900' }
    return { label: 'Aman', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200 dark:border-emerald-900' }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">Produk</h1>
          <p className="mt-2 text-slate-500 dark:text-zinc-400">Kelola SKU produk dan informasi inventaris</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Tambah SKU Baru
        </button>
      </div>

      {/* Products Table - Desktop */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  SKU Barcode
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Nama Produk
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Warna
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Ukuran
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Stok
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
              {products.map((product) => {
                const status = getStockStatus(product.stock)
                return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-zinc-100">
                      {product.sku}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-900 dark:text-zinc-100">
                      {product.name}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                      {product.color}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm text-slate-600 dark:text-zinc-400">
                      {product.size}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {product.stock}
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full border ${status.color}`}>
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedProductForStock(product)
                            setStockValue(product.stock.toString())
                            setIsStockModalOpen(true)
                          }}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                          title="Edit Stok"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProductForLabel(product)
                            setIsLabelModalOpen(true)
                          }}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                          title="Cetak Label"
                        >
                          <Printer className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                          title="Hapus"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-zinc-400">
                    Tidak ada produk ditemukan. Tambah SKU pertama Anda untuk memulai.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {products.map((product) => {
          const status = getStockStatus(product.stock)
          return (
            <div key={product.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{product.name}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{product.sku}</p>
                </div>
                <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full border ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Warna</p>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{product.color}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Ukuran</p>
                  <p className="font-medium text-slate-900 dark:text-zinc-100">{product.size}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400">Stok</p>
                  <p className="font-semibold text-slate-900 dark:text-zinc-100">{product.stock}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-3 border-t border-slate-200 dark:border-zinc-800">
                <button
                  onClick={() => {
                    setSelectedProductForStock(product)
                    setStockValue(product.stock.toString())
                    setIsStockModalOpen(true)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-lg text-sm font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                  Edit Stok
                </button>
                <button
                  onClick={() => {
                    setSelectedProductForLabel(product)
                    setIsLabelModalOpen(true)
                  }}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 rounded-lg text-sm font-medium hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors"
                >
                  <Printer className="h-4 w-4" />
                  Label
                </button>
                <button
                  onClick={() => handleDelete(product.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-lg text-sm font-medium hover:bg-red-100 dark:hover:bg-red-900 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Hapus
                </button>
              </div>
            </div>
          )
        })}
        {products.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-12 text-center text-slate-500 dark:text-zinc-400">
            Tidak ada produk ditemukan. Tambah SKU pertama Anda untuk memulai.
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Tambah SKU Produk Baru</h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Nama Produk
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Aurelia Ruffle Dress"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Warna
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="contoh: Hitam"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Ukuran
                </label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="contoh: L"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Kode SKU Barcode
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="contoh: AURELIA-BLK-L"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                  Ini akan digunakan sebagai pengenal barcode untuk pemindaian
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Menambahkan...' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Instruksi</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• Klik "Tambah SKU Baru" untuk membuat produk baru dengan pengenal barcode</li>
          <li>• Kode SKU akan digunakan untuk pemindaian barcode dalam proses pengemasan</li>
          <li>• Produk baru mulai dengan stok 0 dan perlu ditambahkan melalui Input QC</li>
          <li>• Klik ikon printer untuk mencetak label thermal 50x30mm</li>
          <li>• Hapus produk dengan hati-hati - ini akan menghapus semua log inventaris terkait</li>
        </ul>
      </div>

      {/* Edit Stock Modal */}
      {isStockModalOpen && selectedProductForStock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Edit Stok</h2>
              <button
                onClick={() => setIsStockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="mb-4 p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800">
                <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{selectedProductForStock.name}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">SKU: {selectedProductForStock.sku}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{selectedProductForStock.color} / {selectedProductForStock.size}</p>
              </div>

              <form onSubmit={handleUpdateStock} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Jumlah Stok Baru
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockValue}
                    onChange={(e) => setStockValue(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-lg font-semibold"
                    required
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                    Stok saat ini: {selectedProductForStock.stock}
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsStockModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-emerald-600 dark:bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {loading ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Label Printing Modal */}
      {isLabelModalOpen && selectedProductForLabel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Cetak Label Thermal</h2>
              <button
                onClick={() => setIsLabelModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              {/* Label Preview - 50x30mm */}
              <div className="bg-white border-2 border-slate-300 rounded-lg p-3 mx-auto" style={{ width: '300px', height: '180px' }}>
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-900 mb-1">TENZE INVENTORY</div>
                  <div className="flex justify-center mb-2">
                    <QRCodeCanvas 
                      value={selectedProductForLabel.sku} 
                      size={60}
                      level="L"
                      includeMargin={false}
                    />
                  </div>
                  <div className="text-xs font-semibold text-slate-900 mb-0.5">{selectedProductForLabel.name}</div>
                  <div className="text-xs text-slate-600 mb-0.5">{selectedProductForLabel.color} / {selectedProductForLabel.size}</div>
                  <div className="text-xs font-mono text-slate-800">{selectedProductForLabel.sku}</div>
                  <div className="text-xs font-bold text-emerald-600 mt-1">QC PASSED</div>
                </div>
              </div>
              
              <div className="mt-4 text-center text-sm text-slate-500 dark:text-zinc-400">
                <p>Preview label ukuran 50x30mm</p>
                <p className="text-xs mt-1">Klik cetak untuk mengirim ke printer thermal</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsLabelModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    window.print()
                    setIsLabelModalOpen(false)
                  }}
                  className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Cetak
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}