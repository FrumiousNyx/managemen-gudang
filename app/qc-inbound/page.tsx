'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { ShoppingCart, Plus, Search, Printer, X } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

export default function QCInbound() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
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

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.size.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    if (!selectedProduct) {
      showToast('error', 'Silakan pilih produk')
      return
    }

    const qty = parseInt(quantity)
    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Silakan masukkan jumlah yang valid')
      return
    }

    setLoading(true)

    try {
      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ stock: selectedProduct.stock + qty })
        .eq('id', selectedProduct.id)

      if (updateError) throw updateError

      // Insert inventory log
      const { error: logError } = await supabase
        .from('inventory_logs')
        .insert({
          product_id: selectedProduct.id,
          type: 'INBOUND_QC',
          qty: qty,
          notes: `QC Inbound: ${qty} units`
        })

      if (logError) throw logError

      showToast('success', `Berhasil menambahkan ${qty} unit ke ${selectedProduct.name}`)
      
      // Reset form
      setSelectedProduct(null)
      setQuantity('')
      setSearchTerm('')
      
      // Refresh products
      await fetchProducts()
    } catch (error) {
      console.error('Error adding stock:', error)
      showToast('error', 'Gagal menambah stok')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">Barang Masuk</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400">Tambah produk yang lulus quality control ke stok gudang</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
              Pilih Produk SKU
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan Nama, SKU, Warna, atau Ukuran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
              />
            </div>
            
            {searchTerm && filteredProducts.length > 0 && (
              <div className="mt-3 border border-slate-200 dark:border-zinc-800 rounded-xl max-h-64 overflow-y-auto bg-white dark:bg-zinc-900 shadow-sm">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(product)
                      setSearchTerm(`${product.name} - ${product.sku}`)
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-slate-50 dark:hover:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 last:border-b-0 transition-colors"
                  >
                    <div className="font-medium text-slate-900 dark:text-zinc-100">{product.name}</div>
                    <div className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                      SKU: {product.sku} | {product.color} | Size: {product.size}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Product Display */}
          {selectedProduct && (
            <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-slate-900 dark:text-zinc-100">Produk Terpilih</h3>
                <button
                  onClick={() => {
                    setSelectedProductForLabel(selectedProduct)
                    setIsLabelModalOpen(true)
                  }}
                  className="flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Cetak Label
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Nama:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">SKU:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.sku}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Warna:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.color}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Ukuran:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.size}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Stok Saat Ini:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.stock}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
              Jumlah (Jumlah QC yang Lulus)
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Masukkan jumlah..."
              className="w-full px-4 py-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-lg"
              disabled={!selectedProduct}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedProduct || !quantity || loading}
            className="w-full flex items-center justify-center px-4 py-4 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 dark:border-zinc-700 border-t-slate-900 dark:border-t-zinc-100 mr-2"></div>
                Memproses...
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 mr-2" />
                Tambah Stok Gudang
              </>
            )}
          </button>
        </form>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Instruksi</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• Cari dan pilih produk SKU dari dropdown</li>
          <li>• Masukkan jumlah barang yang lulus QC</li>
          <li>• Klik "Tambah Stok Gudang" untuk menambah stok ke gudang</li>
          <li>• Klik "Cetak Label" untuk mencetak label thermal 50x30mm</li>
          <li>• Transaksi akan dicatat dalam audit trail inventaris</li>
        </ul>
      </div>

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