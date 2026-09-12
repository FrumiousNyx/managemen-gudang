'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase, Product } from '@/lib/supabase'
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
              size: 50mm 30mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 50mm;
              height: 30mm;
              background: #fff;
              color: #000;
              font-family: Arial, sans-serif;
              overflow: hidden;
            }
            .container {
              width: 100%;
              height: 100%;
              padding: 1.5mm 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              text-align: center;
            }
            .title { 
              font-size: 9px; 
              font-weight: 800; 
              letter-spacing: 0.5px;
              text-transform: uppercase;
              line-height: 1;
            }
            .qr-container { 
              display: flex; 
              justify-content: center; 
              align-items: center;
              flex: 1;
              margin: 1px 0;
            }
            .qr-container svg { 
              width: 75px !important; 
              height: 75px !important; 
            }
            .name { 
              font-size: 10px; 
              font-weight: bold; 
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
            }
            .details { 
              font-size: 8px; 
              font-weight: 600;
              color: #222; 
              line-height: 1;
            }
            .sku { 
              font-size: 9px; 
              font-family: 'Courier New', monospace; 
              font-weight: 800; 
              letter-spacing: 0.5px;
              line-height: 1;
            }
            .qc { 
              font-size: 7.5px; 
              font-weight: 800; 
              color: #16a34a; 
              line-height: 1;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="title">TENZE INVENTORY</div>
            <div class="qr-container">${qrSvgHtml}</div>
            <div class="name">${product.name}</div>
            <div class="details">${product.color} / ${product.size}</div>
            <div class="sku">${product.sku}</div>
            <div class="qc">QC PASSED</div>
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
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Tambah produk yang lulus quality control ke stok gudang</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8">
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
                className="w-full pl-12 pr-4 py-3 sm:py-4 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-sm sm:text-base"
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
        
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
          <h4 className="font-semibold text-slate-900 dark:text-zinc-100 mb-2 text-sm">Tips Pengaturan Printer Thermal</h4>
          <ul className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
            <li>• Pilih printer thermal pada Destination (bukan Microsoft Print to PDF)</li>
            <li>• Klik More settings → Paper size: 50mm x 30mm atau 2 x 1.2 inches</li>
            <li>• Margins: None (Tanpa margin)</li>
            <li>• Hilangkan centang Headers and footers untuk menghilangkan tanggal & URL</li>
          </ul>
        </div>
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
              <div 
                id="thermal-label-print"
                className="bg-white border-2 border-slate-300 rounded-lg p-3 mx-auto" 
                style={{ width: '300px', height: '180px' }}
              >
                <div className="text-center">
                  <div className="text-xs font-bold text-slate-900 mb-1">TENZE INVENTORY</div>
                  <div className="flex justify-center mb-2" id="thermal-label-preview">
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
                  onClick={() => handlePrintLabel(selectedProductForLabel)}
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