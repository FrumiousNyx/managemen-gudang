'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { getStockStatus, isLowStock } from '@/lib/stock-utils'
import { useToast } from '@/components/toast-provider'
import { Package, Plus, Edit, Trash2, X, Printer, Save, ArrowUpDown, Search, Download, Upload, FileSpreadsheet } from 'lucide-react'
import QRCode from 'react-qr-code'
import * as XLSX from 'xlsx'

export default function Products() {
  const [products, setProducts] = useState<Product[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false)
  const [isStockModalOpen, setIsStockModalOpen] = useState(false)
  const [isBulkStockModalOpen, setIsBulkStockModalOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [selectedProductForLabel, setSelectedProductForLabel] = useState<Product | null>(null)
  const [selectedProductForStock, setSelectedProductForStock] = useState<Product | null>(null)
  const [stockValue, setStockValue] = useState('')
  const [bulkStockValue, setBulkStockValue] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    color: '',
    size: '',
    sku: ''
  })
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] }>({
    success: 0,
    failed: 0,
    errors: []
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'status'>('status')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [showBulkActions, setShowBulkActions] = useState(false)
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

  const filteredProducts = products.filter((product) => {
    if (!searchQuery.trim()) return true
    const keywords = searchQuery.toLowerCase().trim().split(/\s+/)
    const searchTarget = `${product.sku} ${product.name} ${product.color} ${product.size}`.toLowerCase()
    return keywords.every((keyword) => searchTarget.includes(keyword))
  })

  // Custom size order for sorting
  const sizeOrder: { [key: string]: number } = {
    'XS': 0,
    'S': 1,
    'M': 2,
    'L': 3,
    'XL': 4,
    '2XL': 5,
    '3XL': 6,
    '4XL': 7,
    '5XL': 8
  }

  const getSizeOrder = (size: string): number => {
    return sizeOrder[size] ?? 999 // Unknown sizes go last
  }

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'name':
        // Sort by name, then color, then size (with custom order)
        const nameCompare = a.name.localeCompare(b.name)
        if (nameCompare !== 0) return sortOrder === 'asc' ? nameCompare : -nameCompare
        
        const colorCompare = a.color.localeCompare(b.color)
        if (colorCompare !== 0) return sortOrder === 'asc' ? colorCompare : -colorCompare
        
        const sizeCompare = getSizeOrder(a.size) - getSizeOrder(b.size)
        return sortOrder === 'asc' ? sizeCompare : -sizeCompare
      case 'stock':
        return sortOrder === 'asc' 
          ? a.stock - b.stock
          : b.stock - a.stock
      case 'status':
        const aStatus = getStockStatus(a)
        const bStatus = getStockStatus(b)
        const statusOrder = { 'Menipis': 0, 'Aman': 1 }
        const statusCompare = (statusOrder[aStatus.label as keyof typeof statusOrder] ?? 2) - (statusOrder[bStatus.label as keyof typeof statusOrder] ?? 2)
        // ASC: Menipis (0) first, Aman (1) second
        // DESC: Aman (1) first, Menipis (0) second
        return sortOrder === 'asc' ? statusCompare : -statusCompare
      default:
        return 0
    }
  })

  const exportToExcel = () => {
    const exportData = sortedProducts.map(product => ({
      SKU: product.sku,
      'Nama Produk': product.name,
      Warna: product.color,
      Ukuran: product.size,
      Stok: product.stock,
      Status: getStockStatus(product).label
    }))

    const worksheet = XLSX.utils.json_to_sheet(exportData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Produk')

    // Set column widths
    worksheet['!cols'] = [
      { wch: 15 }, // SKU
      { wch: 25 }, // Nama Produk
      { wch: 10 }, // Warna
      { wch: 8 },  // Ukuran
      { wch: 8 },  // Stok
      { wch: 10 }  // Status
    ]

    XLSX.writeFile(workbook, `daftar-produk-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setImporting(true)
    setImportResults({ success: 0, failed: 0, errors: [] })

    try {
      const data = await file.arrayBuffer()
      const workbook = XLSX.read(data, { type: 'array' })
      const sheetName = workbook.SheetNames[0]
      const worksheet = workbook.Sheets[sheetName]
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[]

      if (jsonData.length === 0) {
        showToast('error', 'File Excel kosong')
        setImporting(false)
        return
      }

      let successCount = 0
      let failedCount = 0
      const errors: string[] = []

      for (const row of jsonData) {
        try {
          // Map column names (support both English and Indonesian)
          const sku = row['SKU'] || row['sku'] || row['Sku']
          const name = row['Nama Produk'] || row['Nama'] || row['name'] || row['Name']
          const color = row['Warna'] || row['color'] || row['Color']
          const size = row['Ukuran'] || row['size'] || row['Size']
          const stock = row['Stok'] || row['stock'] || row['Stock'] || 0

          if (!sku || !name || !color || !size) {
            errors.push(`Baris ${jsonData.indexOf(row) + 1}: Data tidak lengkap (SKU, Nama, Warna, Ukuran wajib diisi)`)
            failedCount++
            continue
          }

          // Check if SKU already exists
          const { data: existingProduct } = await supabase
            .from('products')
            .select('id')
            .eq('sku', sku)
            .single()

          if (existingProduct) {
            errors.push(`Baris ${jsonData.indexOf(row) + 1}: SKU ${sku} sudah ada`)
            failedCount++
            continue
          }

          // Insert product
          const { error } = await supabase
            .from('products')
            .insert({
              sku,
              name,
              color,
              size,
              stock: parseInt(stock) || 0
            })

          if (error) throw error

          successCount++
        } catch (error) {
          errors.push(`Baris ${jsonData.indexOf(row) + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          failedCount++
        }
      }

      setImportResults({ success: successCount, failed: failedCount, errors })
      
      if (successCount > 0) {
        showToast('success', `${successCount} produk berhasil diimpor`)
        await fetchProducts()
      }
      
      if (failedCount > 0) {
        showToast('error', `${failedCount} produk gagal diimpor`)
      }
    } catch (error) {
      console.error('Error importing Excel:', error)
      showToast('error', 'Gagal membaca file Excel')
    } finally {
      setImporting(false)
      // Reset file input
      e.target.value = ''
    }
  }

  const downloadTemplate = () => {
    const templateData = [
      {
        SKU: 'PROD-001',
        'Nama Produk': 'Contoh Produk',
        Warna: 'Hitam',
        Ukuran: 'L',
        Stok: 10
      },
      {
        SKU: 'PROD-002',
        'Nama Produk': 'Contoh Produk',
        Warna: 'Putih',
        Ukuran: 'XL',
        Stok: 5
      }
    ]

    const worksheet = XLSX.utils.json_to_sheet(templateData)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template')

    worksheet['!cols'] = [
      { wch: 15 }, // SKU
      { wch: 25 }, // Nama Produk
      { wch: 10 }, // Warna
      { wch: 8 },  // Ukuran
      { wch: 8 }   // Stok
    ]

    XLSX.writeFile(workbook, 'template-import-produk.xlsx')
  }

  const handleSelectProduct = (productId: string) => {
    const newSelected = new Set(selectedProducts)
    if (newSelected.has(productId)) {
      newSelected.delete(productId)
    } else {
      newSelected.add(productId)
    }
    setSelectedProducts(newSelected)
    setShowBulkActions(newSelected.size > 0)
  }

  const handleSelectAll = () => {
    if (selectedProducts.size === sortedProducts.length) {
      setSelectedProducts(new Set())
      setShowBulkActions(false)
    } else {
      setSelectedProducts(new Set(sortedProducts.map(p => p.id)))
      setShowBulkActions(true)
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedProducts.size} produk?`)) return

    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .in('id', Array.from(selectedProducts))

      if (error) throw error

      showToast('success', `${selectedProducts.size} produk berhasil dihapus`)
      setSelectedProducts(new Set())
      setShowBulkActions(false)
      await fetchProducts()
    } catch (error) {
      console.error('Error bulk deleting products:', error)
      showToast('error', 'Gagal menghapus produk')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkStockUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase || selectedProducts.size === 0) {
      showToast('error', 'Koneksi database tidak dikonfigurasi atau tidak ada produk dipilih')
      return
    }

    const adjustment = parseInt(bulkStockValue)
    if (isNaN(adjustment) || adjustment === 0) {
      showToast('error', 'Masukkan angka yang valid (bukan 0)')
      return
    }

    setLoading(true)
    try {
      for (const productId of selectedProducts) {
        const product = products.find(p => p.id === productId)
        if (!product) continue

        const newStock = product.stock + adjustment
        if (newStock < 0) {
          showToast('error', `Stok tidak bisa negatif untuk ${product.name}`)
          continue
        }

        // Update product stock
        const { error: updateError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId)

        if (updateError) throw updateError

        // Log to inventory_logs
        const { error: logError } = await supabase
          .from('inventory_logs')
          .insert({
            product_id: productId,
            type: adjustment > 0 ? 'INBOUND_QC' : 'OUTBOUND_PACKING',
            qty: adjustment,
            notes: 'Penyesuaian stok massal dari halaman Produk'
          })

        if (logError) throw logError
      }

      showToast('success', `Stok ${selectedProducts.size} produk berhasil diperbarui`)
      setIsBulkStockModalOpen(false)
      setBulkStockValue('')
      setSelectedProducts(new Set())
      setShowBulkActions(false)
      await fetchProducts()
    } catch (error) {
      console.error('Error bulk updating stock:', error)
      showToast('error', 'Gagal memperbarui stok')
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: 'name' | 'stock' | 'status') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('asc')
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
            notes: 'Penyesuaian stok manual dari halaman Produk'
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
              padding: 2mm 2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
            }
            .qr-container { 
              display: flex; 
              justify-content: center; 
              align-items: center;
              margin: 2px 0;
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
          </style>
        </head>
        <body>
          <div class="container">
            <div class="qr-container">${qrSvgHtml}</div>
            <div class="name">${product.name}</div>
            <div class="details">${product.color} / ${product.size}</div>
            <div class="sku">${product.sku}</div>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Produk</h1>
          <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Kelola SKU produk dan informasi inventaris</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={exportToExcel}
            disabled={sortedProducts.length === 0}
            className="flex items-center justify-center px-4 py-2 bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-5 w-5 mr-2" />
            Export Excel
          </button>
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center justify-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 transition-all flex-1 sm:flex-none"
          >
            <Upload className="h-5 w-5 mr-2" />
            Import Excel
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all flex-1 sm:flex-none"
          >
            <Plus className="h-5 w-5 mr-2" />
            Tambah SKU Baru
          </button>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {showBulkActions && (
        <div className="mb-4 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedProducts.size === sortedProducts.length}
              onChange={handleSelectAll}
              className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-amber-600 focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-amber-900 dark:text-amber-100">
              {selectedProducts.size} produk dipilih
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsBulkStockModalOpen(true)}
              className="flex items-center px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Edit className="h-4 w-4 mr-1" />
              Update Stok
            </button>
            <button
              onClick={handleBulkDelete}
              className="flex items-center px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Hapus
            </button>
            <button
              onClick={() => {
                setSelectedProducts(new Set())
                setShowBulkActions(false)
              }}
              className="flex items-center px-3 py-2 text-slate-700 dark:text-zinc-400 text-sm font-medium rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-800 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-4 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan SKU, Nama, Warna, atau Ukuran..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
          {searchQuery ? `Ditemukan ${sortedProducts.length} produk` : `Total ${products.length} produk`}
        </p>
      </div>

      {/* Sort Controls - Mobile */}
      <div className="md:hidden mb-4 bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4">
        <div className="flex gap-2">
          <button
            onClick={() => handleSort('name')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              sortBy === 'name' 
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800' 
                : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400'
            }`}
          >
            Nama
          </button>
          <button
            onClick={() => handleSort('stock')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              sortBy === 'stock' 
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800' 
                : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400'
            }`}
          >
            Stok
          </button>
          <button
            onClick={() => handleSort('status')}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              sortBy === 'status' 
                ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800' 
                : 'bg-slate-50 dark:bg-zinc-800 text-slate-700 dark:text-zinc-400'
            }`}
          >
            Status
          </button>
        </div>
      </div>

      {/* Products Table - Desktop */}
      <div className="hidden md:block bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
            <thead className="bg-slate-50 dark:bg-zinc-800">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider w-10">
                  <input
                    type="checkbox"
                    checked={selectedProducts.size === sortedProducts.length && sortedProducts.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-slate-600 focus:ring-slate-500"
                  />
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  SKU Barcode
                </th>
                <th 
                  className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => handleSort('name')}
                >
                  <div className="flex items-center gap-1">
                    Nama Produk
                    {sortBy === 'name' && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Warna
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Ukuran
                </th>
                <th 
                  className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => handleSort('stock')}
                >
                  <div className="flex items-center gap-1">
                    Stok
                    {sortBy === 'stock' && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </th>
                <th 
                  className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                  onClick={() => handleSort('status')}
                >
                  <div className="flex items-center gap-1">
                    Status
                    {sortBy === 'status' && <ArrowUpDown className="h-3 w-3" />}
                  </div>
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-800 divide-y divide-slate-200 dark:divide-zinc-800">
              {sortedProducts.map((product) => {
                const status = getStockStatus(product)
                return (
                  <tr key={product.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors">
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(product.id)}
                        onChange={() => handleSelectProduct(product.id)}
                        className="w-4 h-4 rounded border-slate-300 dark:border-zinc-600 text-slate-600 focus:ring-slate-500"
                      />
                    </td>
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
              {sortedProducts.length === 0 && (
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
        {sortedProducts.map((product) => {
          const status = getStockStatus(product)
          return (
            <div key={product.id} className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4">
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
        {sortedProducts.length === 0 && (
          <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-12 text-center text-slate-500 dark:text-zinc-400">
            Tidak ada produk ditemukan. Tambah SKU pertama Anda untuk memulai.
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800">
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
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                  Nama Produk
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., Rocela"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                  Warna
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  placeholder="contoh: Hitam"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                  Ukuran
                </label>
                <input
                  type="text"
                  value={formData.size}
                  onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                  placeholder="contoh: L"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                  Kode SKU Barcode
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="contoh: RCL-BLK-L"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
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
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Menambahkan...' : 'Tambah Produk'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className="mt-6 bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Instruksi</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• Klik "Tambah SKU Baru" untuk membuat produk baru dengan pengenal barcode</li>
          <li>• Kode SKU akan digunakan untuk pemindaian barcode dalam proses pengemasan</li>
          <li>• Produk baru mulai dengan stok 0 dan perlu ditambahkan melalui Input QC</li>
          <li>• Klik ikon printer untuk mencetak label thermal 50x30mm</li>
          <li>• Hapus produk dengan hati-hati - ini akan menghapus semua log inventaris terkait</li>
          <li>• Gunakan kolom pencarian untuk mencari produk berdasarkan SKU, nama, warna, atau ukuran</li>
          <li>• Pencarian mendukung multi-kata (contoh: "rocela hitam L")</li>
          <li>• Klik header tabel (Nama, Stok, Status) untuk mengurutkan produk</li>
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

      {/* Edit Stock Modal */}
      {isStockModalOpen && selectedProductForStock && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-zinc-800">
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
              <div className="mb-4 p-4 bg-slate-50 dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-800">
                <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{selectedProductForStock.name}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">SKU: {selectedProductForStock.sku}</p>
                <p className="text-xs text-slate-500 dark:text-zinc-400">{selectedProductForStock.color} / {selectedProductForStock.size}</p>
              </div>

              <form onSubmit={handleUpdateStock} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                    Jumlah Stok Baru
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={stockValue}
                    onChange={(e) => setStockValue(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-lg font-semibold"
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
                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
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
              {/* Label Preview - 50x30mm */}
              <div 
                id="thermal-label-print"
                className="bg-white border-2 border-slate-300 rounded-lg p-3 mx-auto" 
                style={{ width: '300px', height: '180px' }}
              >
                <div className="text-center">
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
                </div>
              </div>
              
              <div className="mt-4 text-center text-sm text-slate-500 dark:text-zinc-400">
                <p>Preview label ukuran 50x30mm</p>
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

      {/* Bulk Stock Update Modal */}
      {isBulkStockModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl max-w-md w-full border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Update Stok Bulk</h2>
              <button
                onClick={() => setIsBulkStockModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                Update stok untuk {selectedProducts.size} produk yang dipilih
              </p>
              
              <form onSubmit={handleBulkStockUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                    Penyesuaian Stok
                  </label>
                  <input
                    type="number"
                    value={bulkStockValue}
                    onChange={(e) => setBulkStockValue(e.target.value)}
                    placeholder="Gunakan angka positif untuk tambah, negatif untuk kurangi"
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    required
                  />
                  <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                    Contoh: 10 untuk tambah 10, -5 untuk kurangi 5
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsBulkStockModalOpen(false)}
                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all"
                  >
                    {loading ? 'Memproses...' : 'Update Stok'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Import Excel Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-xl max-w-2xl w-full border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Import Produk dari Excel</h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6">
              {!importing && importResults.success === 0 && importResults.failed === 0 ? (
                <>
                  <div className="mb-6">
                    <button
                      onClick={downloadTemplate}
                      className="flex items-center px-4 py-2 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 font-medium rounded-lg hover:bg-emerald-200 dark:hover:bg-emerald-900 transition-colors mb-4"
                    >
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Download Template Excel
                    </button>
                    <p className="text-sm text-slate-600 dark:text-zinc-400">
                      Download template untuk melihat format yang diperlukan. Kolom yang wajib diisi: SKU, Nama Produk, Warna, Ukuran. Stok bersifat opsional (default 0).
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-xl p-8 text-center">
                    <Upload className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                    <p className="text-sm text-slate-600 dark:text-zinc-400 mb-4">
                      Pilih file Excel (.xlsx atau .xls) yang berisi data produk
                    </p>
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleImportExcel}
                      disabled={importing}
                      className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 dark:file:bg-emerald-950 dark:file:text-emerald-400 dark:hover:file:bg-emerald-900 transition-all"
                    />
                  </div>

                  <div className="mt-6 bg-slate-50 dark:bg-zinc-800 rounded-xl p-4">
                    <h4 className="font-semibold text-slate-900 dark:text-zinc-100 mb-2 text-sm">Format Kolom:</h4>
                    <ul className="text-xs text-slate-600 dark:text-zinc-400 space-y-1">
                      <li>• <strong>SKU</strong>: Kode unik untuk produk (wajib)</li>
                      <li>• <strong>Nama Produk</strong> atau <strong>Nama</strong>: Nama produk (wajib)</li>
                      <li>• <strong>Warna</strong> atau <strong>Color</strong>: Warna produk (wajib)</li>
                      <li>• <strong>Ukuran</strong> atau <strong>Size</strong>: Ukuran produk (wajib)</li>
                      <li>• <strong>Stok</strong> atau <strong>Stock</strong>: Jumlah stok awal (opsional, default 0)</li>
                    </ul>
                  </div>
                </>
              ) : importing ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-4 border-slate-200 dark:border-zinc-800 border-t-emerald-600 mx-auto mb-4"></div>
                  <p className="text-sm text-slate-600 dark:text-zinc-400">Mengimpor produk...</p>
                </div>
              ) : (
                <div>
                  <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-950 rounded-xl border border-emerald-200 dark:border-emerald-800">
                    <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                      ✅ {importResults.success} produk berhasil diimpor
                    </p>
                    {importResults.failed > 0 && (
                      <p className="text-sm font-medium text-red-700 dark:text-red-400 mt-2">
                        ❌ {importResults.failed} produk gagal diimpor
                      </p>
                    )}
                  </div>

                  {importResults.errors.length > 0 && (
                    <div className="mb-6 max-h-48 overflow-y-auto">
                      <h4 className="font-semibold text-slate-900 dark:text-zinc-100 mb-2 text-sm">Error Log:</h4>
                      <div className="bg-red-50 dark:bg-red-950 rounded-xl p-4 border border-red-200 dark:border-red-800">
                        {importResults.errors.map((error, index) => (
                          <p key={index} className="text-xs text-red-700 dark:text-red-400 mb-1">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setIsImportModalOpen(false)
                        setImportResults({ success: 0, failed: 0, errors: [] })
                      }}
                      className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                    >
                      Tutup
                    </button>
                    {importResults.failed > 0 && (
                      <button
                        onClick={() => {
                          setImportResults({ success: 0, failed: 0, errors: [] })
                        }}
                        className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-400 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                      >
                        Import Lagi
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}