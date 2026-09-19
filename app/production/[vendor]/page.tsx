'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { CardSkeleton, Skeleton } from '@/components/skeleton'
import { Scissors, Plus, Calendar, Package, Layers, Edit, Trash2, Download, Upload, Scan, X } from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { Html5QrcodeScanner } from 'html5-qrcode'

interface Vendor {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
}

interface Product {
  id: string
  sku: string
  name: string
  color: string
  size: string
}

interface VendorProduction {
  id: string
  vendor_id: string
  cut_date: string
  raw_fabric_id: string | null
  raw_fabric_material_type: string | null
  raw_fabric_quantity_used: number | null
  raw_fabric_unit: string | null
  total_pieces: number
  status: string
  notes: string | null
  created_at: string
  vendor: Vendor
  cuts: VendorCut[]
}

interface VendorCut {
  id: string
  production_id: string
  product_id: string
  quantity: number
  product: Product
}

export default function VendorProductionPage() {
  const params = useParams()
  const router = useRouter()
  const vendorSlug = params.vendor as string
  const { showToast } = useToast()

  const [productions, setProductions] = useState<VendorProduction[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [rawFabrics, setRawFabrics] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduction, setEditingProduction] = useState<VendorProduction | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<{ productId: string; quantity: number }[]>([])
  const [showScanner, setShowScanner] = useState(false)
  const [scannerTargetIndex, setScannerTargetIndex] = useState<number | null>(null)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  const [formData, setFormData] = useState({
    cut_date: new Date().toISOString().split('T')[0],
    raw_fabric_id: '',
    raw_fabric_material_type: 'Rayon',
    raw_fabric_quantity_used: '',
    raw_fabric_unit: 'Yard',
    status: 'In Progress',
    notes: ''
  })

  const vendorNameMap: Record<string, string> = {
    'bapak-iwan': 'Iwan',
    'bapak-cecep': 'Cecep',
    'bapak-didin': 'Didin'
  }

  const vendorName = vendorNameMap[vendorSlug] || vendorSlug

  useEffect(() => {
    fetchData()
  }, [vendorSlug])

  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
      }
    }
  }, [])

  const fetchData = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      // Get vendor by name
      const { data: vendorData, error: vendorError } = await supabase
        .from('vendors')
        .select('*')
        .eq('name', vendorName)
        .single()

      if (vendorError || !vendorData) {
        showToast('error', 'Vendor tidak ditemukan')
        router.push('/')
        return
      }

      // Fetch productions for this vendor
      const { data: productionsData, error: productionsError } = await supabase
        .from('vendor_production')
        .select('*, vendor:vendors(*), cuts:vendor_cuts(*, product:products(*))')
        .eq('vendor_id', vendorData.id)
        .order('cut_date', { ascending: false })

      if (productionsError) throw productionsError

      // Fetch all products for dropdown
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (productsError) throw productsError

      // Fetch raw fabrics
      const { data: rawFabricsData, error: rawFabricsError } = await supabase
        .from('raw_fabric')
        .select('*')
        .order('created_at', { ascending: false })

      if (rawFabricsError) throw rawFabricsError

      setProductions(productionsData || [])
      setProducts(productsData || [])
      setRawFabrics(rawFabricsData || [])
    } catch (error) {
      console.error('Error fetching data:', error)
      showToast('error', 'Gagal memuat data produksi')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    if (selectedProducts.length === 0) {
      showToast('error', 'Pilih minimal satu produk')
      return
    }

    try {
      // Get vendor
      const { data: vendorData } = await supabase
        .from('vendors')
        .select('id')
        .eq('name', vendorName)
        .single()

      if (!vendorData) {
        showToast('error', 'Vendor tidak ditemukan')
        return
      }

      const productionData = {
        vendor_id: vendorData.id,
        cut_date: formData.cut_date,
        raw_fabric_id: formData.raw_fabric_id || null,
        raw_fabric_material_type: formData.raw_fabric_material_type || null,
        raw_fabric_quantity_used: formData.raw_fabric_quantity_used ? parseFloat(formData.raw_fabric_quantity_used) : null,
        raw_fabric_unit: formData.raw_fabric_unit || null,
        total_pieces: selectedProducts.reduce((sum, p) => sum + p.quantity, 0),
        status: formData.status,
        notes: formData.notes || null
      }

      let productionId: string

      if (editingProduction) {
        const { data, error } = await supabase
          .from('vendor_production')
          .update(productionData)
          .eq('id', editingProduction.id)
          .select()
          .single()

        if (error) throw error
        productionId = data.id

        // Delete existing cuts
        await supabase
          .from('vendor_cuts')
          .delete()
          .eq('production_id', editingProduction.id)

        showToast('success', 'Data produksi berhasil diperbarui')
      } else {
        const { data, error } = await supabase
          .from('vendor_production')
          .insert(productionData)
          .select()
          .single()

        if (error) throw error
        productionId = data.id

        showToast('success', 'Data produksi berhasil ditambahkan')
      }

      // Insert new cuts
      for (const selectedProduct of selectedProducts) {
        await supabase
          .from('vendor_cuts')
          .insert({
            production_id: productionId,
            product_id: selectedProduct.productId,
            quantity: selectedProduct.quantity
          })
      }

      setShowForm(false)
      setEditingProduction(null)
      setSelectedProducts([])
      setFormData({
        cut_date: new Date().toISOString().split('T')[0],
        raw_fabric_id: '',
        raw_fabric_material_type: 'Rayon',
        raw_fabric_quantity_used: '',
        raw_fabric_unit: 'Yard',
        status: 'In Progress',
        notes: ''
      })
      fetchData()
    } catch (error) {
      console.error('Error saving production:', error)
      showToast('error', 'Gagal menyimpan data produksi')
    }
  }

  const handleEdit = (production: VendorProduction) => {
    setEditingProduction(production)
    setFormData({
      cut_date: production.cut_date,
      raw_fabric_id: production.raw_fabric_id || '',
      raw_fabric_material_type: production.raw_fabric_material_type || 'Rayon',
      raw_fabric_quantity_used: production.raw_fabric_quantity_used?.toString() || '',
      raw_fabric_unit: production.raw_fabric_unit || 'Yard',
      status: production.status,
      notes: production.notes || ''
    })
    
    const cuts = production.cuts.map(cut => ({
      productId: cut.product_id,
      quantity: cut.quantity
    }))
    setSelectedProducts(cuts)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus data ini?')) return

    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    try {
      const { error } = await supabase
        .from('vendor_production')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('success', 'Data produksi berhasil dihapus')
      fetchData()
    } catch (error) {
      console.error('Error deleting production:', error)
      showToast('error', 'Gagal menghapus data produksi')
    }
  }

  const addProductCut = () => {
    setSelectedProducts([...selectedProducts, { productId: '', quantity: 1 }])
  }

  const updateProductCut = (index: number, field: 'productId' | 'quantity', value: string | number) => {
    const updated = [...selectedProducts]
    updated[index] = { ...updated[index], [field]: value }
    setSelectedProducts(updated)
  }

  const removeProductCut = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index))
  }

  const handleScanSuccess = (decodedText: string) => {
    // Find product by SKU
    const product = products.find(p => p.sku === decodedText)
    if (product) {
      if (scannerTargetIndex !== null) {
        updateProductCut(scannerTargetIndex, 'productId', product.id)
      }
      setShowScanner(false)
      setScannerTargetIndex(null)
      showToast('success', `Produk ditemukan: ${product.name}`)
    } else {
      showToast('error', 'Produk tidak ditemukan')
    }
  }

  const startScanner = (index: number) => {
    setScannerTargetIndex(index)
    setShowScanner(true)
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        'scanner',
        { fps: 10, qrbox: { width: 250, height: 250 } },
        false
      )
      scanner.render(handleScanSuccess, (error) => {
        console.error('Scanner error:', error)
      })
      scannerRef.current = scanner
    }, 100)
  }

  const stopScanner = () => {
    if (scannerRef.current) {
      scannerRef.current.clear()
      scannerRef.current = null
    }
    setShowScanner(false)
    setScannerTargetIndex(null)
  }

  const exportToExcel = () => {
    const exportData = productions.map(prod => ({
      'Tanggal Potong': prod.cut_date,
      'Material': prod.raw_fabric_material_type || '-',
      'Jumlah Material': prod.raw_fabric_quantity_used ? `${prod.raw_fabric_quantity_used} ${prod.raw_fabric_unit}` : '-',
      'Total Pcs': prod.total_pieces,
      'Status': prod.status,
      'Catatan': prod.notes || '-'
    }))

    const ws = XLSX.utils.json_to_sheet(exportData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Produksi')
    XLSX.writeFile(wb, `produksi-${vendorName}-${new Date().toISOString().split('T')[0]}.xlsx`)
    showToast('success', 'Excel berhasil di-download')
  }

  const exportToPDF = () => {
    const doc = new jsPDF()
    
    doc.setFontSize(18)
    doc.text(`Laporan Produksi - ${vendorName}`, 14, 22)
    
    doc.setFontSize(10)
    doc.setTextColor(100)
    doc.text(`Generated on ${new Date().toLocaleDateString('id-ID')}`, 14, 30)

    const tableData = productions.map(prod => [
      prod.cut_date,
      prod.raw_fabric_material_type || '-',
      prod.raw_fabric_quantity_used ? `${prod.raw_fabric_quantity_used} ${prod.raw_fabric_unit}` : '-',
      prod.total_pieces.toString(),
      prod.status,
      prod.notes || '-'
    ])

    autoTable(doc, {
      startY: 40,
      head: [['Tanggal', 'Material', 'Jumlah', 'Total Pcs', 'Status', 'Catatan']],
      body: tableData,
      styles: {
        fontSize: 9,
        cellPadding: 3
      },
      headStyles: {
        fillColor: [71, 85, 105],
        textColor: 255,
        fontStyle: 'bold'
      }
    })

    doc.save(`produksi-${vendorName}-${new Date().toISOString().split('T')[0]}.pdf`)
    showToast('success', 'PDF berhasil di-download')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      case 'QC Passed': return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      case 'Delivered': return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
      case 'In Progress': return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">
          Monitoring Vendor: {vendorName}
        </h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">
          Pencatatan hasil potongan harian
        </p>
      </div>

      <div className="mb-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => {
            setEditingProduction(null)
            setSelectedProducts([])
            setFormData({
              cut_date: new Date().toISOString().split('T')[0],
              raw_fabric_id: '',
              raw_fabric_material_type: 'Rayon',
              raw_fabric_quantity_used: '',
              raw_fabric_unit: 'Yard',
              status: 'In Progress',
              notes: ''
            })
            setShowForm(!showForm)
          }}
          className="flex items-center px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors"
        >
          {showForm ? <Scissors className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Tutup Form' : 'Tambah Produksi'}
        </button>
        <button
          onClick={exportToExcel}
          className="flex items-center px-4 py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export Excel
        </button>
        <button
          onClick={exportToPDF}
          className="flex items-center px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-xl hover:bg-red-700 dark:hover:bg-red-600 transition-colors"
        >
          <Download className="h-4 w-4 mr-2" />
          Export PDF
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-6">
            {editingProduction ? 'Edit Data Produksi' : 'Tambah Data Produksi Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Tanggal Potong *
                </label>
                <input
                  type="date"
                  required
                  value={formData.cut_date}
                  onChange={(e) => setFormData({ ...formData, cut_date: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Jenis Bahan Utuh
                </label>
                <select
                  value={formData.raw_fabric_material_type}
                  onChange={(e) => setFormData({ ...formData, raw_fabric_material_type: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                >
                  <option value="Rayon">Rayon</option>
                  <option value="Spandex Balon">Spandex Balon</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Batch Kain (Opsional)
                </label>
                <select
                  value={formData.raw_fabric_id}
                  onChange={(e) => setFormData({ ...formData, raw_fabric_id: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                >
                  <option value="">Pilih batch kain</option>
                  {rawFabrics.map((fabric) => (
                    <option key={fabric.id} value={fabric.id}>
                      {fabric.batch_code} - {fabric.name} ({fabric.material_type})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Jumlah Kain Dipakai
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.raw_fabric_quantity_used}
                    onChange={(e) => setFormData({ ...formData, raw_fabric_quantity_used: e.target.value })}
                    className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="0"
                  />
                  <select
                    value={formData.raw_fabric_unit}
                    onChange={(e) => setFormData({ ...formData, raw_fabric_unit: e.target.value })}
                    className="px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  >
                    <option value="Yard">Yard</option>
                    <option value="Meter">Meter</option>
                    <option value="Kg">Kg</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                >
                  <option value="In Progress">In Progress</option>
                  <option value="Completed">Completed</option>
                  <option value="QC Passed">QC Passed</option>
                  <option value="Delivered">Delivered</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Catatan
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="Catatan produksi..."
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">
                  Daftar Produk yang Dipotong *
                </label>
                <button
                  type="button"
                  onClick={addProductCut}
                  className="flex items-center px-3 py-2 text-sm bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Tambah Produk
                </button>
              </div>
              
              <div className="space-y-3">
                {selectedProducts.map((selectedProduct, index) => (
                  <div key={index} className="flex gap-3 items-center">
                    <select
                      required
                      value={selectedProduct.productId}
                      onChange={(e) => updateProductCut(index, 'productId', e.target.value)}
                      className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    >
                      <option value="">Pilih produk</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.sku} - {product.name} ({product.color} / {product.size})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => startScanner(index)}
                      className="p-3 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 rounded-xl transition-colors"
                      title="Scan barcode"
                    >
                      <Scan className="h-5 w-5" />
                    </button>
                    <input
                      type="number"
                      required
                      min="1"
                      value={selectedProduct.quantity}
                      onChange={(e) => updateProductCut(index, 'quantity', parseInt(e.target.value))}
                      className="w-24 px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                      placeholder="Jml"
                    />
                    <button
                      type="button"
                      onClick={() => removeProductCut(index)}
                      className="p-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 rounded-xl transition-colors"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
              >
                {editingProduction ? 'Update' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingProduction(null)
                  setSelectedProducts([])
                }}
                className="px-6 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {productions.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-12 text-center">
          <Scissors className="h-16 w-16 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-zinc-400">Belum ada data produksi. Klik "Tambah Produksi" untuk memulai.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {productions.map((production) => (
            <div
              key={production.id}
              className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Calendar className="h-5 w-5 text-slate-400" />
                    <h3 className="font-semibold text-slate-900 dark:text-zinc-100">
                      {new Date(production.cut_date).toLocaleDateString('id-ID', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </h3>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(production.status)}`}>
                      {production.status}
                    </span>
                  </div>
                  {production.raw_fabric_material_type && (
                    <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-zinc-400">
                      <Layers className="h-4 w-4" />
                      <span>{production.raw_fabric_material_type}</span>
                      {production.raw_fabric_quantity_used && (
                        <span>- {production.raw_fabric_quantity_used} {production.raw_fabric_unit}</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(production)}
                    className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(production.id)}
                    className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-200 dark:border-zinc-800 pt-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-slate-700 dark:text-zinc-300">
                    Hasil Potongan
                  </span>
                  <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                    Total: {production.total_pieces} pcs
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {production.cuts.map((cut) => (
                    <div
                      key={cut.id}
                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                          {cut.product.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {cut.product.sku} • {cut.product.color} / {cut.product.size}
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-zinc-100">
                        {cut.quantity} pcs
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {production.notes && (
                <div className="mt-4 pt-4 border-t border-slate-200 dark:border-zinc-800">
                  <p className="text-sm text-slate-500 dark:text-zinc-400">
                    <span className="font-medium">Catatan:</span> {production.notes}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Scanner Modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Scan Barcode</h2>
              <button
                onClick={stopScanner}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div id="scanner" className="mb-4"></div>
            <p className="text-sm text-slate-500 dark:text-zinc-400 text-center">
              Arahkan kamera ke barcode produk
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
