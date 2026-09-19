'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Product } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { ShoppingCart, Plus, Search, Printer, X } from 'lucide-react'
import QRCode from 'react-qr-code'

export default function QCInbound() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(false)
  const [batchMode, setBatchMode] = useState(false)
  const [batchItems, setBatchItems] = useState<{ product: Product; quantity: number }[]>([])
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
      // Try to get from cache first
      const cachedData = cache.get(CACHE_KEYS.PRODUCTS)
      if (cachedData) {
        setProducts(cachedData)
        return
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      
      const products = data || []
      setProducts(products)
      
      // Cache the results for 5 minutes
      cache.set(CACHE_KEYS.PRODUCTS, products, 5 * 60 * 1000)
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

    if (batchMode) {
      // Add to batch
      const existingIndex = batchItems.findIndex(item => item.product.id === selectedProduct.id)
      if (existingIndex >= 0) {
        // Update existing item
        const updatedBatch = [...batchItems]
        updatedBatch[existingIndex].quantity += qty
        setBatchItems(updatedBatch)
        showToast('success', `Diperbarui: ${selectedProduct.name} (${updatedBatch[existingIndex].quantity} unit)`)
      } else {
        // Add new item
        setBatchItems([...batchItems, { product: selectedProduct, quantity: qty }])
        showToast('success', `Ditambahkan: ${selectedProduct.name} (${qty} unit)`)
      }

      // Reset form for next item
      setSelectedProduct(null)
      setQuantity('')
      setSearchTerm('')
    } else {
      // Single product mode - process immediately
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
            notes: `Barang masuk QC: ${qty} unit`
          })

        if (logError) throw logError

        showToast('success', `Berhasil menambahkan ${qty} unit ke ${selectedProduct.name}`)

        // Clear cache to force refresh
        cache.delete(CACHE_KEYS.PRODUCTS)

        // Reset form
        setSelectedProduct(null)
        setQuantity('')
        setSearchTerm('')

        // Refresh products and router
        await fetchProducts()
        router.refresh()
      } catch (error) {
        console.error('Error adding stock:', error)
        showToast('error', 'Gagal menambah stok')
      } finally {
        setLoading(false)
      }
    }
  }

  const handleBatchSubmit = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    if (batchItems.length === 0) {
      showToast('error', 'Tidak ada item dalam batch')
      return
    }

    setLoading(true)

    try {
      let successCount = 0
      let failedCount = 0

      for (const item of batchItems) {
        try {
          // Update product stock
          const { error: updateError } = await supabase
            .from('products')
            .update({ stock: item.product.stock + item.quantity })
            .eq('id', item.product.id)

          if (updateError) throw updateError

          // Insert inventory log
          const { error: logError } = await supabase
            .from('inventory_logs')
            .insert({
              product_id: item.product.id,
              type: 'INBOUND_QC',
              qty: item.quantity,
              notes: `Barang masuk QC (batch): ${item.quantity} unit`
            })

          if (logError) throw logError

          successCount++
        } catch (error) {
          console.error(`Error processing ${item.product.name}:`, error)
          failedCount++
        }
      }

      // Clear cache to force refresh
      cache.delete(CACHE_KEYS.PRODUCTS)

      showToast('success', `Batch selesai: ${successCount} berhasil, ${failedCount} gagal`)

      // Reset form
      setBatchItems([])
      setSelectedProduct(null)
      setQuantity('')
      setSearchTerm('')
      setBatchMode(false)

      // Refresh products and router
      await fetchProducts()
      router.refresh()
    } catch (error) {
      console.error('Error processing batch:', error)
      showToast('error', 'Gagal memproses batch')
    } finally {
      setLoading(false)
    }
  }

  const removeBatchItem = (productId: string) => {
    setBatchItems(batchItems.filter(item => item.product.id !== productId))
  }

  const clearBatch = () => {
    setBatchItems([])
  }

  const handlePrintLabel = (product: Product) => {
    const iframe = document.createElement('iframe')
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)

    const doc = iframe.contentWindow?.document
    if (!doc) return

    const qrSvgElement = document.querySelector('#thermal-label-preview svg')
    const qrSvgHtml = qrSvgElement ? qrSvgElement.outerHTML : ''

    doc.open()
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Label - ${product.sku}</title>
          <style>
            @page {
              size: 40mm 20mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 40mm;
              height: 20mm;
              background: #fff;
              color: #000;
              font-family: Arial, sans-serif;
              overflow: hidden;
            }
            .container {
              width: 100%;
              height: 100%;
              padding: 1.5mm 1.5mm;
              display: flex;
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              gap: 1mm;
            }
            .qr-side {
              flex-shrink: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .qr-container svg { 
              width: 60px !important; 
              height: 60px !important; 
            }
            .text-side {
              flex: 1;
              display: flex;
              flex-direction: column;
              justify-content: center;
              gap: 0.5mm;
              min-width: 0;
            }
            .name { 
              font-size: 9px; 
              font-weight: bold; 
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .details { 
              font-size: 7px; 
              font-weight: 600;
              color: #222; 
              line-height: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .sku { 
              font-size: 8px; 
              font-family: 'Courier New', monospace; 
              font-weight: 800; 
              letter-spacing: 0.3px;
              line-height: 1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="qr-side">
              <div class="qr-container">${qrSvgHtml}</div>
            </div>
            <div class="text-side">
              <div class="name">${product.name}</div>
              <div class="details">${product.color} / ${product.size}</div>
              <div class="sku">${product.sku}</div>
            </div>
          </div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
      </html>
    `)
    doc.close()

    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Barang Masuk</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Tambah barang masuk ke stok gudang</p>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-8">
        {/* Batch Mode Toggle */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-400">Mode Batch</label>
            <button
              type="button"
              onClick={() => setBatchMode(!batchMode)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                batchMode ? 'bg-slate-900 dark:bg-zinc-100' : 'bg-slate-200 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  batchMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          {batchMode && batchItems.length > 0 && (
            <button
              type="button"
              onClick={clearBatch}
              className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
            >
              Hapus Semua
            </button>
          )}
        </div>

        {/* Batch Items List */}
        {batchMode && batchItems.length > 0 && (
          <div className="mb-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl p-4">
            <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Item Batch ({batchItems.length})</h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {batchItems.map((item) => (
                <div
                  key={item.product.id}
                  className="flex items-center justify-between bg-white dark:bg-zinc-800 p-3 rounded-lg border border-slate-200 dark:border-zinc-800"
                >
                  <div className="flex-1">
                    <div className="font-medium text-slate-900 dark:text-zinc-100">{item.product.name}</div>
                    <div className="text-xs text-slate-500 dark:text-zinc-400">
                      {item.product.sku} | {item.product.color} / {item.product.size}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900 dark:text-zinc-100">{item.quantity} unit</span>
                    <button
                      type="button"
                      onClick={() => removeBatchItem(item.product.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={handleBatchSubmit}
              disabled={loading}
              className="mt-4 w-full flex items-center justify-center px-4 py-3 bg-emerald-600 dark:bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all"
            >
              {loading ? 'Memproses...' : 'Proses Semua Batch'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-3">
              Pilih Produk SKU
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari berdasarkan Nama, SKU, Warna, atau Ukuran..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 sm:py-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-sm sm:text-base"
              />
            </div>
            
            {searchTerm && filteredProducts.length > 0 && (
              <div className="mt-3 border border-slate-200 dark:border-zinc-800 rounded-xl max-h-64 overflow-y-auto bg-white dark:bg-zinc-800 shadow-sm">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => {
                      setSelectedProduct(product)
                      setSearchTerm(`${product.name} - ${product.sku}`)
                    }}
                    className="w-full text-left px-4 py-4 hover:bg-slate-50 dark:hover:bg-zinc-800 border-b border-slate-200 dark:border-zinc-800 last:border-b-0 transition-colors"
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
            <div className="bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
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
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-3">
              Jumlah Barang
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Masukkan jumlah..."
              className="w-full px-4 py-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-lg"
              disabled={!selectedProduct}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!selectedProduct || !quantity || loading}
            className="w-full flex items-center justify-center px-4 py-4 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-slate-200 dark:border-zinc-700 border-t-slate-900 dark:border-t-zinc-100 mr-2"></div>
                Memproses...
              </>
            ) : (
              <>
                <Plus className="h-5 w-5 mr-2" />
                {batchMode ? 'Tambah ke Batch' : 'Tambah Stok Gudang'}
              </>
            )}
          </button>
        </form>
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Instruksi</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• Cari dan pilih produk SKU dari dropdown</li>
          <li>• Masukkan jumlah barang yang masuk</li>
          <li>• Mode Normal: Klik "Tambah Stok Gudang" untuk langsung menambah stok</li>
          <li>• Mode Batch: Nyalakan toggle untuk menambahkan multiple produk sekaligus, lalu klik "Proses Semua Batch"</li>
          <li>• Klik "Cetak Label" untuk mencetak label thermal 33x19mm atau 40x20mm</li>
          <li>• Transaksi akan dicatat dalam riwayat inventaris</li>
        </ul>
      </div>

      {/* Label Printing Modal */}
      {isLabelModalOpen && selectedProductForLabel && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800">
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
              {/* Label Preview - 40x20mm horizontal layout */}
              <div
                id="thermal-label-print"
                className="bg-white border-2 border-slate-300 rounded-lg p-3 mx-auto flex items-center gap-3"
                style={{ width: '300px', height: '150px' }}
              >
                <div className="flex-shrink-0" id="thermal-label-preview">
                  {selectedProductForLabel.sku ? (
                    <QRCode
                      value={selectedProductForLabel.sku}
                      size={60}
                    />
                  ) : (
                    <div className="w-[60px] h-[60px] bg-slate-200 flex items-center justify-center text-xs text-slate-500">
                      No SKU
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-900 mb-0.5 truncate">{selectedProductForLabel.name}</div>
                  <div className="text-xs text-slate-600 mb-0.5 truncate">{selectedProductForLabel.color} / {selectedProductForLabel.size}</div>
                  <div className="text-xs font-mono text-slate-800 truncate">{selectedProductForLabel.sku}</div>
                </div>
              </div>

              <div className="mt-4 text-center text-sm text-slate-500 dark:text-zinc-400">
                <p>Preview label ukuran 40x20mm (horizontal)</p>
                <p className="text-xs mt-1">Klik cetak untuk mengirim ke printer thermal</p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setIsLabelModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => handlePrintLabel(selectedProductForLabel)}
                  className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
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