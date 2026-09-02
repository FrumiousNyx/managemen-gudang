'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Package, Plus, Edit, Trash2, X } from 'lucide-react'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
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
      showToast('error', 'Gagal menambah produk')
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

      {/* Products Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
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
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
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
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Instructions</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• Click "Add New SKU" to create a new product with its barcode identifier</li>
          <li>• The SKU code will be used for barcode scanning in the packing process</li>
          <li>• New products start with 0 stock and need to be added via QC Inbound</li>
          <li>• Delete products carefully - this will remove all associated inventory logs</li>
        </ul>
      </div>
    </div>
  )
}