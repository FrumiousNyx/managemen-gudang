'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { cache, CACHE_KEYS } from '@/lib/cache'
import { useToast } from '@/components/toast-provider'
import { CardSkeleton, Skeleton } from '@/components/skeleton'
import { Layers, Plus, Edit, Trash2, AlertTriangle, Package } from 'lucide-react'

interface RawFabric {
  id: string
  batch_code: string
  name: string
  material_type: string
  quantity: number
  unit: string
  color: string | null
  supplier: string | null
  status: string
  minimum_stock: number
  created_at: string
  updated_at: string
}

export default function RawFabric() {
  const [fabrics, setFabrics] = useState<RawFabric[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingFabric, setEditingFabric] = useState<RawFabric | null>(null)
  const { showToast } = useToast()

  const [formData, setFormData] = useState({
    batch_code: '',
    name: '',
    material_type: 'Rayon',
    quantity: '',
    unit: 'Yard',
    color: '',
    supplier: '',
    status: 'Available',
    minimum_stock: '10'
  })

  useEffect(() => {
    fetchFabrics()
  }, [])

  const fetchFabrics = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('raw_fabric')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      
      setFabrics(data || [])
    } catch (error) {
      console.error('Error fetching fabrics:', error)
      showToast('error', 'Gagal memuat data kain')
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

    try {
      const fabricData = {
        batch_code: formData.batch_code,
        name: formData.name,
        material_type: formData.material_type,
        quantity: parseFloat(formData.quantity),
        unit: formData.unit,
        color: formData.color || null,
        supplier: formData.supplier || null,
        status: formData.status,
        minimum_stock: parseFloat(formData.minimum_stock)
      }

      if (editingFabric) {
        const { error } = await supabase
          .from('raw_fabric')
          .update(fabricData)
          .eq('id', editingFabric.id)

        if (error) throw error
        showToast('success', 'Data kain berhasil diperbarui')
      } else {
        const { error } = await supabase
          .from('raw_fabric')
          .insert(fabricData)

        if (error) throw error
        showToast('success', 'Data kain berhasil ditambahkan')
      }

      setShowForm(false)
      setEditingFabric(null)
      setFormData({
        batch_code: '',
        name: '',
        material_type: 'Rayon',
        quantity: '',
        unit: 'Yard',
        color: '',
        supplier: '',
        status: 'Available',
        minimum_stock: '10'
      })
      fetchFabrics()
    } catch (error) {
      console.error('Error saving fabric:', error)
      showToast('error', 'Gagal menyimpan data kain')
    }
  }

  const handleEdit = (fabric: RawFabric) => {
    setEditingFabric(fabric)
    setFormData({
      batch_code: fabric.batch_code,
      name: fabric.name,
      material_type: fabric.material_type,
      quantity: fabric.quantity.toString(),
      unit: fabric.unit,
      color: fabric.color || '',
      supplier: fabric.supplier || '',
      status: fabric.status,
      minimum_stock: fabric.minimum_stock.toString()
    })
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
        .from('raw_fabric')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('success', 'Data kain berhasil dihapus')
      fetchFabrics()
    } catch (error) {
      console.error('Error deleting fabric:', error)
      showToast('error', 'Gagal menghapus data kain')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Available': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      case 'In Process': return 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400'
      case 'Completed': return 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
      case 'Low Stock': return 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400'
      default: return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
    }
  }

  const isLowStock = (fabric: RawFabric) => {
    return fabric.quantity <= fabric.minimum_stock
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Kain Utuh (Raw Fabric)</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Kelola stok kain mentah - Rayon dan Spandex Balon</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => {
            setEditingFabric(null)
            setFormData({
              batch_code: '',
              name: '',
              material_type: 'Rayon',
              quantity: '',
              unit: 'Yard',
              color: '',
              supplier: '',
              status: 'Available',
              minimum_stock: '10'
            })
            setShowForm(!showForm)
          }}
          className="flex items-center px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 transition-colors"
        >
          {showForm ? <Layers className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {showForm ? 'Tutup Form' : 'Tambah Kain'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-8">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-6">
            {editingFabric ? 'Edit Data Kain' : 'Tambah Data Kain Baru'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Kode Batch *
                </label>
                <input
                  type="text"
                  required
                  value={formData.batch_code}
                  onChange={(e) => setFormData({ ...formData, batch_code: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="Contoh: RAY-001"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Nama Kain *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="Contoh: Rayon Premium"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Jenis Material *
                </label>
                <select
                  required
                  value={formData.material_type}
                  onChange={(e) => setFormData({ ...formData, material_type: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                >
                  <option value="Rayon">Rayon</option>
                  <option value="Spandex Balon">Spandex Balon</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Jumlah *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="0"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Satuan *
                </label>
                <select
                  required
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                >
                  <option value="Yard">Yard</option>
                  <option value="Meter">Meter</option>
                  <option value="Kg">Kg</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Warna
                </label>
                <input
                  type="text"
                  value={formData.color}
                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="Contoh: Putih"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Supplier
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="Contoh: Supplier A"
                />
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
                  <option value="Available">Available</option>
                  <option value="In Process">In Process</option>
                  <option value="Completed">Completed</option>
                  <option value="Low Stock">Low Stock</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Minimum Stock *
                </label>
                <input
                  type="number"
                  required
                  step="0.01"
                  min="0"
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="10"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
              >
                {editingFabric ? 'Update' : 'Simpan'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false)
                  setEditingFabric(null)
                }}
                className="px-6 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
              >
                Batal
              </button>
            </div>
          </form>
        </div>
      )}

      {fabrics.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-12 text-center">
          <Package className="h-16 w-16 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-zinc-400">Belum ada data kain. Klik "Tambah Kain" untuk memulai.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {fabrics.map((fabric) => (
            <div
              key={fabric.id}
              className={`bg-white dark:bg-zinc-900 rounded-2xl border ${
                isLowStock(fabric) 
                  ? 'border-red-300 dark:border-red-800 shadow-sm shadow-red-100 dark:shadow-red-950' 
                  : 'border-slate-200 dark:border-zinc-800 shadow-sm'
              } p-6`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-zinc-100">{fabric.name}</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">{fabric.batch_code}</p>
                </div>
                {isLowStock(fabric) && (
                  <div className="flex items-center text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Material</span>
                  <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">{fabric.material_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Jumlah</span>
                  <span className={`text-sm font-medium ${isLowStock(fabric) ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-zinc-100'}`}>
                    {fabric.quantity} {fabric.unit}
                  </span>
                </div>
                {fabric.color && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-zinc-400">Warna</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">{fabric.color}</span>
                  </div>
                )}
                {fabric.supplier && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-500 dark:text-zinc-400">Supplier</span>
                    <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">{fabric.supplier}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500 dark:text-zinc-400">Status</span>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${getStatusColor(fabric.status)}`}>
                    {fabric.status}
                  </span>
                </div>
              </div>

              <div className="flex gap-2 mt-6 pt-4 border-t border-slate-200 dark:border-zinc-800">
                <button
                  onClick={() => handleEdit(fabric)}
                  className="flex-1 flex items-center justify-center px-3 py-2 text-sm bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 rounded-lg hover:bg-slate-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-1" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(fabric.id)}
                  className="flex-1 flex items-center justify-center px-3 py-2 text-sm bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
