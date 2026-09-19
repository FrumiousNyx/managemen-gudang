'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Users, Plus, Edit, Trash2, X, Phone, Mail, MapPin, User, Calendar } from 'lucide-react'

interface Vendor {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  production_days: string[] | null
  notes: string | null
  is_active: boolean
  created_at: string
}

const DAY_OPTIONS = [
  { value: 'monday', label: 'Senin' },
  { value: 'tuesday', label: 'Selasa' },
  { value: 'wednesday', label: 'Rabu' },
  { value: 'thursday', label: 'Kamis' },
  { value: 'friday', label: 'Jumat' },
  { value: 'saturday', label: 'Sabtu' },
  { value: 'sunday', label: 'Minggu' },
]

export default function Vendors() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    production_days: [] as string[],
    notes: '',
    is_active: true
  })
  const { showToast } = useToast()

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setVendors(data || [])
    } catch (error) {
      console.error('Error fetching vendors:', error)
      showToast('error', 'Gagal memuat data vendor')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenModal = (vendor?: Vendor) => {
    if (vendor) {
      setEditingVendor(vendor)
      setFormData({
        name: vendor.name,
        contact_person: vendor.contact_person || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        address: vendor.address || '',
        production_days: vendor.production_days || [],
        notes: vendor.notes || '',
        is_active: vendor.is_active
      })
    } else {
      setEditingVendor(null)
      setFormData({
        name: '',
        contact_person: '',
        phone: '',
        email: '',
        address: '',
        production_days: [],
        notes: '',
        is_active: true
      })
    }
    setIsModalOpen(true)
  }

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingVendor(null)
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      production_days: [],
      notes: '',
      is_active: true
    })
  }

  const handleDayToggle = (day: string) => {
    setFormData(prev => ({
      ...prev,
      production_days: prev.production_days.includes(day)
        ? prev.production_days.filter(d => d !== day)
        : [...prev.production_days, day]
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    setLoading(true)
    try {
      if (editingVendor) {
        const { error } = await supabase
          .from('vendors')
          .update(formData)
          .eq('id', editingVendor.id)

        if (error) throw error
        showToast('success', 'Vendor berhasil diperbarui')
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert([formData])

        if (error) throw error
        showToast('success', 'Vendor berhasil ditambahkan')
      }

      handleCloseModal()
      await fetchVendors()
    } catch (error) {
      console.error('Error saving vendor:', error)
      showToast('error', 'Gagal menyimpan vendor')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!supabase) return
    if (!confirm('Apakah Anda yakin ingin menghapus vendor ini?')) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)

      if (error) throw error
      showToast('success', 'Vendor berhasil dihapus')
      await fetchVendors()
    } catch (error) {
      console.error('Error deleting vendor:', error)
      showToast('error', 'Gagal menghapus vendor')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleActive = async (vendor: Vendor) => {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('vendors')
        .update({ is_active: !vendor.is_active })
        .eq('id', vendor.id)

      if (error) throw error
      showToast('success', `Vendor ${vendor.is_active ? 'dinonaktifkan' : 'diaktifkan'}`)
      await fetchVendors()
    } catch (error) {
      console.error('Error toggling vendor status:', error)
      showToast('error', 'Gagal mengubah status vendor')
    }
  }

  const getProductionDaysLabel = (days: string[] | null) => {
    if (!days || days.length === 0) return 'Tidak ada hari produksi'
    return days.map(day => {
      const dayOption = DAY_OPTIONS.find(d => d.value === day)
      return dayOption ? dayOption.label : day
    }).join(', ')
  }

  if (loading && vendors.length === 0) {
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
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Vendor Jahit</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Kelola vendor jahit untuk outsourcing produksi</p>
      </div>

      <div className="mb-6">
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center px-6 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
        >
          <Plus className="h-5 w-5 mr-2" />
          Tambah Vendor
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {vendors.map((vendor) => (
          <div
            key={vendor.id}
            className={`bg-white dark:bg-zinc-900 rounded-2xl border ${
              vendor.is_active
                ? 'border-slate-200 dark:border-zinc-800'
                : 'border-slate-300 dark:border-zinc-700 opacity-60'
            } shadow-sm p-6`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-zinc-100">{vendor.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    vendor.is_active
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {vendor.is_active ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleOpenModal(vendor)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleDelete(vendor.id)}
                  className="p-2 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {vendor.contact_person && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
                <User className="h-4 w-4" />
                <span>{vendor.contact_person}</span>
              </div>
            )}

            {vendor.phone && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
                <Phone className="h-4 w-4" />
                <span>{vendor.phone}</span>
              </div>
            )}

            {vendor.email && (
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
                <Mail className="h-4 w-4" />
                <span>{vendor.email}</span>
              </div>
            )}

            {vendor.address && (
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
                <MapPin className="h-4 w-4 mt-0.5" />
                <span>{vendor.address}</span>
              </div>
            )}

            {vendor.production_days && vendor.production_days.length > 0 && (
              <div className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-400 mb-2">
                <Calendar className="h-4 w-4 mt-0.5" />
                <span>{getProductionDaysLabel(vendor.production_days)}</span>
              </div>
            )}

            <button
              onClick={() => handleToggleActive(vendor)}
              className="mt-4 w-full py-2 text-sm font-medium border border-slate-200 dark:border-zinc-800 rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors"
            >
              {vendor.is_active ? 'Nonaktifkan' : 'Aktifkan'}
            </button>
          </div>
        ))}
      </div>

      {vendors.length === 0 && !loading && (
        <div className="text-center py-12">
          <Users className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-zinc-400">Belum ada vendor jahit</p>
          <button
            onClick={() => handleOpenModal()}
            className="mt-4 text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Tambah vendor pertama
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
                  {editingVendor ? 'Edit Vendor' : 'Tambah Vendor'}
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
                    Nama Vendor *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="Contoh: Iwan"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Kontak Person
                  </label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="Nama kontak"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Telepon
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="081234567890"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    placeholder="email@example.com"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Alamat
                  </label>
                  <textarea
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all resize-none"
                    placeholder="Alamat lengkap"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                    Hari Produksi
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {DAY_OPTIONS.map((day) => (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => handleDayToggle(day.value)}
                        className={`px-3 py-2 text-sm rounded-lg border transition-colors ${
                          formData.production_days.includes(day.value)
                            ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 border-slate-900 dark:border-zinc-100'
                            : 'bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
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

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 text-slate-900 dark:text-zinc-100 border-slate-300 dark:border-zinc-700 rounded focus:ring-slate-900 dark:focus:ring-zinc-100"
                  />
                  <label htmlFor="isActive" className="text-sm text-slate-700 dark:text-zinc-300">
                    Vendor aktif
                  </label>
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
                    {loading ? 'Menyimpan...' : editingVendor ? 'Simpan' : 'Tambah'}
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
