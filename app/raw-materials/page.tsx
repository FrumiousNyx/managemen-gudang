'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Scissors, Plus, Edit, Trash2, X, Building2, Package, TrendingUp } from 'lucide-react'

interface RawMaterial {
  id: string
  supplier_id: string
  name: string
  type: string
  color: string | null
  quantity: number
  unit: string
  unit_price: number | null
  status: string
  notes: string | null
  created_at: string
  supplier: {
    name: string
  } | null
  initial_quantity: number
  outbound_quantity: number
  balance_quantity: number
}

interface Supplier {
  id: string
  name: string
}

export default function RawMaterials() {
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    supplier_id: '',
    name: '',
    type: 'kain',
    color: '',
    quantity: '',
    unit: 'rol',
    unit_price: '',
    status: 'available',
    notes: ''
  })
  const { showToast } = useToast()

  useEffect(() => {
    fetchRawMaterials()
    fetchSuppliers()
  }, [])

  const fetchRawMaterials = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*, supplier:suppliers(name)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setRawMaterials(data || [])
    } catch (error) {
      console.error('Error fetching raw materials:', error)
      showToast('error', 'Gagal memuat data kain')
    } finally {
      setLoading(false)
    }
  }

  const handleInbound = async (material: RawMaterial, qty: number) => {
    if (!supabase) return

    try {
      const newInitialQuantity = material.initial_quantity + qty
      const { error } = await supabase
        .from('raw_materials')
        .update({ initial_quantity: newInitialQuantity })
        .eq('id', material.id)

      if (error) throw error

      // Log the transaction
      await supabase
        .from('raw_material_logs')
        .insert([{
          raw_material_id: material.id,
          type: 'INBOUND',
          qty: qty,
          notes: `Inbound manual +${qty} ${material.unit}`
        }])

      showToast('success', `Inbound +${qty} ${material.unit} berhasil`)
      await fetchRawMaterials()
    } catch (error) {
      console.error('Error inbound:', error)
      showToast('error', 'Gagal inbound kain')
    }
  }

  const handleOutbound = async (material: RawMaterial, qty: number) => {
    if (!supabase) return
    if (qty > material.balance_quantity) {
      showToast('error', 'Stok tidak mencukupi')
      return
    }

    try {
      const newOutboundQuantity = material.outbound_quantity + qty
      const { error } = await supabase
        .from('raw_materials')
        .update({ outbound_quantity: newOutboundQuantity })
        .eq('id', material.id)

      if (error) throw error

      // Log the transaction
      await supabase
        .from('raw_material_logs')
        .insert([{
          raw_material_id: material.id,
          type: 'OUTBOUND',
          qty: qty,
          notes: `Outbound manual -${qty} ${material.unit}`
        }])

      showToast('success', `Outbound -${qty} ${material.unit} berhasil`)
      await fetchRawMaterials()
    } catch (error) {
      console.error('Error outbound:', error)
      showToast('error', 'Gagal outbound kain')
    }
  }

  const fetchSuppliers = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (error) throw error
      setSuppliers(data || [])
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    }
  }

  const handleOpenModal = (material?: RawMaterial) => {
    if (material) {
      setEditingMaterial(material)
      setFormData({
        supplier_id: material.supplier_id,
        name: material.name,
        type: material.type,
        color: material.color || '',
        quantity: material.quantity.toString(),
        unit: material.unit,
        unit_price: material.unit_price?.toString() || '',
        status: material.status,
        notes: material.notes || ''
      })
    } else {
      setEditingMaterial(null)
      setFormData({
        supplier_id: '',
        name: '',
        type: 'kain',
        color: '',
        quantity: '',
        unit: 'rol',
        unit_price: '',
        status: 'available',
        notes: ''
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingMaterial(null)
    setFormData({
      supplier_id: '',
      name: '',
      type: 'kain',
      color: '',
      quantity: '',
      unit: 'rol',
      unit_price: '',
      status: 'available',
      notes: ''
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    setLoading(true)
    try {
      const payload = {
        supplier_id: formData.supplier_id,
        name: formData.name,
        type: formData.type,
        color: formData.color || null,
        quantity: parseInt(formData.quantity),
        unit: formData.unit,
        unit_price: formData.unit_price ? parseFloat(formData.unit_price) : null,
        status: formData.status,
        notes: formData.notes || null
      }

      if (editingMaterial) {
        const { error } = await supabase
          .from('raw_materials')
          .update(payload)
          .eq('id', editingMaterial.id)

        if (error) throw error
        showToast('success', 'Kain berhasil diperbarui')
      } else {
        const { error } = await supabase
          .from('raw_materials')
          .insert([payload])

        if (error) throw error
        showToast('success', 'Kain berhasil ditambahkan')
      }

      handleCloseModal()
      await fetchRawMaterials()
    } catch (error) {
      console.error('Error saving raw material:', error)
      showToast('error', 'Gagal menyimpan kain')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    if (!confirm('Apakah Anda yakin ingin menghapus kain ini?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('raw_materials')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('success', 'Kain berhasil dihapus')
      await fetchRawMaterials()
    } catch (error) {
      console.error('Error deleting raw material:', error)
      showToast('error', 'Gagal menghapus kain')
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
      case 'in_production':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
      case 'used':
        return 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return 'Tersedia'
      case 'in_production':
        return 'Sedang Diproduksi'
      case 'used':
        return 'Terpakai'
      default:
        return status
    }
  }

  if (loading && rawMaterials.length === 0) {
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
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Kain Belum Jadi</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Kelola kain dan bahan mentah untuk produksi</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Tambah Kain
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rawMaterials.map((material) => (
          <div
            key={material.id}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-purple-50 dark:bg-purple-950 flex items-center justify-center">
                  <Scissors className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-zinc-100">{material.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${getStatusColor(material.status)}`}>
                    {getStatusLabel(material.status)}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(material)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(material.id)}
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {material.supplier && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
                <Building2 className="h-4 w-4" />
                <span>{material.supplier.name}</span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
              <Package className="h-4 w-4" />
              <span>Inbound: {material.initial_quantity} {material.unit}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
              <Package className="h-4 w-4" />
              <span>Outbound: {material.outbound_quantity} {material.unit}</span>
            </div>

            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-zinc-100 mb-2">
              <Package className="h-4 w-4" />
              <span>Balance: {material.balance_quantity} {material.unit}</span>
            </div>

            <div className="flex gap-2 mt-2">
              <button
                onClick={() => {
                  const qty = prompt(`Inbound quantity (${material.unit}):`)
                  if (qty && !isNaN(parseInt(qty))) {
                    handleInbound(material, parseInt(qty))
                  }
                }}
                className="flex-1 py-2 text-xs font-medium bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900 transition-colors"
              >
                + Inbound
              </button>
              <button
                onClick={() => {
                  const qty = prompt(`Outbound quantity (${material.unit}):`)
                  if (qty && !isNaN(parseInt(qty))) {
                    handleOutbound(material, parseInt(qty))
                  }
                }}
                className="flex-1 py-2 text-xs font-medium bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900 transition-colors"
              >
                - Outbound
              </button>
            </div>

            {material.color && (
              <div className="text-sm text-slate-600 dark:text-zinc-400 mb-2">
                Warna: {material.color}
              </div>
            )}

            {material.unit_price && (
              <div className="text-sm text-slate-600 dark:text-zinc-400 mb-2">
                Harga per {material.unit}: Rp {material.unit_price.toLocaleString('id-ID')}
              </div>
            )}

            {material.notes && (
              <div className="text-sm text-slate-500 dark:text-zinc-400 mt-2 italic">
                {material.notes}
              </div>
            )}
          </div>
        ))}
      </div>

      {rawMaterials.length === 0 && !loading && (
        <div className="text-center py-12">
          <Scissors className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-zinc-400">Belum ada kain</p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Tambah kain pertama
          </button>
        </div>
      )}

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
                  {editingMaterial ? 'Edit Kain' : 'Tambah Kain'}
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
                    Supplier *
                  </label>
                  <select
                    required
                    value={formData.supplier_id}
                    onChange={(e) => setFormData({ ...formData, supplier_id: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  >
                    <option value="">Pilih Supplier</option>
                    {suppliers.map((supplier) => (
                      <option key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </option>
                    ))}
                  </select>
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
                    placeholder="Contoh: Kain Katun"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Tipe *
                  </label>
                  <select
                    required
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  >
                    <option value="kain">Kain</option>
                    <option value="benang">Benang</option>
                    <option value="kancing">Kancing</option>
                    <option value="resleting">Resleting</option>
                    <option value="lainnya">Lainnya</option>
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
                    placeholder="Contoh: Hitam"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Jumlah *
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="Contoh: 5"
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
                    <option value="rol">Rol</option>
                    <option value="meter">Meter</option>
                    <option value="kg">Kg</option>
                    <option value="pcs">Pcs</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Harga per Satuan
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="Contoh: 50000"
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
                    <option value="available">Tersedia</option>
                    <option value="in_production">Sedang Diproduksi</option>
                    <option value="used">Terpakai</option>
                  </select>
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
                    {loading ? 'Menyimpan...' : editingMaterial ? 'Simpan' : 'Tambah'}
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
