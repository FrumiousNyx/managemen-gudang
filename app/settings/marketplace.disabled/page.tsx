'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Store, Plus, Edit, Trash2, X, Save, CheckCircle, XCircle, Clock, ExternalLink, RefreshCw } from 'lucide-react'

type MarketplaceConnection = {
  id: string
  platform: 'shopee' | 'tokopedia' | 'tiktok'
  shop_name: string
  created_at: string
  token_expires_at?: string
}

type MarketplaceSkuMapping = {
  id: string
  product_id: string
  platform: 'shopee' | 'tokopedia' | 'tiktok'
  marketplace_item_id: string
  marketplace_variation_id: string
  buffer_stock: number
  synced_at: string
  product?: {
    id: string
    sku: string
    name: string
    color: string
    size: string
    stock: number
  }
}

export default function MarketplaceSettings() {
  const [connections, setConnections] = useState<MarketplaceConnection[]>([])
  const [skuMappings, setSkuMappings] = useState<MarketplaceSkuMapping[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false)
  const [isMappingModalOpen, setIsMappingModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const { showToast } = useToast()

  const [connectionForm, setConnectionForm] = useState({
    platform: 'shopee' as 'shopee' | 'tokopedia' | 'tiktok',
    shop_name: '',
    access_token: '',
    refresh_token: ''
  })

  const [mappingForm, setMappingForm] = useState({
    product_id: '',
    platform: 'shopee' as 'shopee' | 'tokopedia' | 'tiktok',
    marketplace_item_id: '',
    marketplace_variation_id: '',
    buffer_stock: 2
  })

  const [editingMapping, setEditingMapping] = useState<MarketplaceSkuMapping | null>(null)

  useEffect(() => {
    fetchConnections()
    fetchSkuMappings()
    fetchProducts()
  }, [])

  const fetchConnections = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('marketplace_connections')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setConnections(data || [])
    } catch (error) {
      console.error('Error fetching connections:', error)
      showToast('error', 'Gagal memuat koneksi marketplace')
    }
  }

  const fetchSkuMappings = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('marketplace_sku_mappings')
        .select('*, product:products(*)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setSkuMappings(data || [])
    } catch (error) {
      console.error('Error fetching SKU mappings:', error)
      showToast('error', 'Gagal memuat mapping SKU')
    }
  }

  const fetchProducts = async () => {
    if (!supabase) return

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    }
  }

  const handleAddConnection = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    if (!connectionForm.platform || !connectionForm.shop_name || !connectionForm.access_token) {
      showToast('error', 'Silakan isi semua kolom yang diperlukan')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('marketplace_connections')
        .insert({
          platform: connectionForm.platform,
          shop_name: connectionForm.shop_name,
          access_token: connectionForm.access_token,
          refresh_token: connectionForm.refresh_token || null
        })

      if (error) throw error

      showToast('success', 'Koneksi marketplace berhasil ditambahkan')
      setIsConnectionModalOpen(false)
      setConnectionForm({
        platform: 'shopee',
        shop_name: '',
        access_token: '',
        refresh_token: ''
      })
      await fetchConnections()
    } catch (error) {
      console.error('Error adding connection:', error)
      showToast('error', 'Gagal menambah koneksi marketplace')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus koneksi ini?')) return

    if (!supabase) return

    try {
      const { error } = await supabase
        .from('marketplace_connections')
        .delete()
        .eq('id', id)

      if (error) throw error

      showToast('success', 'Koneksi marketplace berhasil dihapus')
      await fetchConnections()
    } catch (error) {
      console.error('Error deleting connection:', error)
      showToast('error', 'Gagal menghapus koneksi marketplace')
    }
  }

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!supabase) {
      showToast('error', 'Koneksi database tidak dikonfigurasi')
      return
    }

    if (!mappingForm.product_id || !mappingForm.platform || !mappingForm.marketplace_item_id) {
      showToast('error', 'Silakan isi semua kolom yang diperlukan')
      return
    }

    setLoading(true)

    try {
      if (editingMapping) {
        // Update existing mapping
        const { error } = await supabase
          .from('marketplace_sku_mappings')
          .update({
            buffer_stock: mappingForm.buffer_stock
          })
          .eq('id', editingMapping.id)

        if (error) throw error
        showToast('success', 'Mapping SKU berhasil diperbarui')
      } else {
        // Add new mapping
        const { error } = await supabase
          .from('marketplace_sku_mappings')
          .insert({
            product_id: mappingForm.product_id,
            platform: mappingForm.platform,
            marketplace_item_id: mappingForm.marketplace_item_id,
            marketplace_variation_id: mappingForm.marketplace_variation_id,
            buffer_stock: mappingForm.buffer_stock
          })

        if (error) throw error
        showToast('success', 'Mapping SKU berhasil ditambahkan')
      }

      setIsMappingModalOpen(false)
      setEditingMapping(null)
      setMappingForm({
        product_id: '',
        platform: 'shopee',
        marketplace_item_id: '',
        marketplace_variation_id: '',
        buffer_stock: 2
      })
      await fetchSkuMappings()
    } catch (error) {
      console.error('Error saving mapping:', error)
      showToast('error', 'Gagal menyimpan mapping SKU')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteMapping = async (id: string) => {
    if (!confirm('Apakah Anda yakin ingin menghapus mapping ini?')) return

    if (!supabase) return

    try {
      const { error } = await supabase
        .from('marketplace_sku_mappings')
        .delete()
        .eq('id', id)

      if (error) throw error

      showToast('success', 'Mapping SKU berhasil dihapus')
      await fetchSkuMappings()
    } catch (error) {
      console.error('Error deleting mapping:', error)
      showToast('error', 'Gagal menghapus mapping SKU')
    }
  }

  const handleEditMapping = (mapping: MarketplaceSkuMapping) => {
    setEditingMapping(mapping)
    setMappingForm({
      product_id: mapping.product_id,
      platform: mapping.platform,
      marketplace_item_id: mapping.marketplace_item_id,
      marketplace_variation_id: mapping.marketplace_variation_id,
      buffer_stock: mapping.buffer_stock
    })
    setIsMappingModalOpen(true)
  }

  const getConnectionStatus = (connection: MarketplaceConnection) => {
    if (!connection.token_expires_at) {
      return { status: 'active', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', label: 'Aktif' }
    }

    const expiryDate = new Date(connection.token_expires_at)
    const now = new Date()
    const daysUntilExpiry = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry <= 0) {
      return { status: 'expired', icon: XCircle, color: 'text-red-600 dark:text-red-400', label: 'Kadaluarsa' }
    } else if (daysUntilExpiry <= 7) {
      return { status: 'expiring', icon: Clock, color: 'text-amber-600 dark:text-amber-400', label: 'Segera Kadaluarsa' }
    } else {
      return { status: 'active', icon: CheckCircle, color: 'text-emerald-600 dark:text-emerald-400', label: 'Aktif' }
    }
  }

  const getPlatformBadge = (platform: string) => {
    const colors = {
      shopee: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      tokopedia: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      tiktok: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200'
    }
    return colors[platform as keyof typeof colors] || 'bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200'
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Integrasi Marketplace</h1>
          <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Kelola koneksi marketplace dan mapping SKU untuk sinkronisasi otomatis</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsConnectionModalOpen(true)}
            className="flex items-center justify-center px-4 py-2 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
          >
            <Store className="h-5 w-5 mr-2" />
            Tambah Koneksi
          </button>
          <button
            onClick={() => setIsMappingModalOpen(true)}
            className="flex items-center justify-center px-4 py-2 bg-emerald-600 dark:bg-emerald-500 text-white font-medium rounded-xl hover:bg-emerald-700 dark:hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-600 dark:focus:ring-emerald-500 focus:ring-offset-2 transition-all"
          >
            <Plus className="h-5 w-5 mr-2" />
            Mapping SKU
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Total Koneksi</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1">{connections.length}</p>
            </div>
            <Store className="h-8 w-8 text-slate-400 dark:text-zinc-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Total Mapping SKU</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1">{skuMappings.length}</p>
            </div>
            <ExternalLink className="h-8 w-8 text-slate-400 dark:text-zinc-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-zinc-400">Platform Terhubung</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-zinc-100 mt-1">
                {new Set(connections.map(c => c.platform)).size}
              </p>
            </div>
            <RefreshCw className="h-8 w-8 text-slate-400 dark:text-zinc-600" />
          </div>
        </div>
      </div>

      {/* Connections Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm mb-8">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Koneksi Marketplace</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Kelola koneksi API ke marketplace untuk sinkronisasi otomatis</p>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-zinc-800">
          {connections.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-zinc-400">
              <Store className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
              <p>Belum ada koneksi marketplace</p>
              <p className="text-sm mt-1">Tambah koneksi pertama Anda untuk memulai integrasi</p>
            </div>
          ) : (
            connections.map((connection) => {
              const status = getConnectionStatus(connection)
              const StatusIcon = status.icon

              return (
                <div key={connection.id} className="p-6 hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 dark:bg-zinc-800">
                        <Store className="h-6 w-6 text-slate-600 dark:text-zinc-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-zinc-100">{connection.shop_name}</h3>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPlatformBadge(connection.platform)}`}>
                            {connection.platform.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <StatusIcon className={`h-4 w-4 ${status.color}`} />
                          <span className={`text-sm ${status.color}`}>{status.label}</span>
                          {connection.token_expires_at && (
                            <span className="text-xs text-slate-500 dark:text-zinc-400">
                              • Berakhir: {new Date(connection.token_expires_at).toLocaleDateString('id-ID')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteConnection(connection.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                      title="Hapus Koneksi"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* SKU Mappings Section */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Mapping SKU Produk</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400 mt-1">Hubungkan produk lokal dengan SKU marketplace untuk sinkronisasi stok</p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Produk Lokal
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Platform
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Marketplace Item ID
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Variation ID
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Buffer Stock
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Terakhir Sync
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
              {skuMappings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500 dark:text-zinc-400">
                    <ExternalLink className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-zinc-600" />
                    <p>Belum ada mapping SKU</p>
                    <p className="text-sm mt-1">Tambah mapping pertama Anda untuk menghubungkan produk dengan marketplace</p>
                  </td>
                </tr>
              ) : (
                skuMappings.map((mapping) => (
                  <tr key={mapping.id} className="hover:bg-slate-50 dark:hover:bg-zinc-950 transition-colors">
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                          {mapping.product?.name || 'Unknown'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400">
                          {mapping.product?.sku} • {mapping.product?.color} / {mapping.product?.size}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getPlatformBadge(mapping.platform)}`}>
                        {mapping.platform.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-900 dark:text-zinc-100 font-mono">
                      {mapping.marketplace_item_id}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-zinc-400 font-mono">
                      {mapping.marketplace_variation_id || '-'}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-semibold text-slate-900 dark:text-zinc-100">
                      {mapping.buffer_stock}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-600 dark:text-zinc-400">
                      {mapping.synced_at ? new Date(mapping.synced_at).toLocaleString('id-ID') : 'Belum sync'}
                    </td>
                    <td className="px-4 py-3.5 text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditMapping(mapping)}
                          className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors"
                          title="Edit Mapping"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteMapping(mapping.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                          title="Hapus Mapping"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Connection Modal */}
      {isConnectionModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Tambah Koneksi Marketplace</h2>
              <button
                onClick={() => setIsConnectionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddConnection} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Platform
                </label>
                <select
                  value={connectionForm.platform}
                  onChange={(e) => setConnectionForm({ ...connectionForm, platform: e.target.value as any })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                >
                  <option value="shopee">Shopee</option>
                  <option value="tokopedia">Tokopedia</option>
                  <option value="tiktok">TikTok Shop</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Nama Toko
                </label>
                <input
                  type="text"
                  value={connectionForm.shop_name}
                  onChange={(e) => setConnectionForm({ ...connectionForm, shop_name: e.target.value })}
                  placeholder="Nama toko Anda di marketplace"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Access Token
                </label>
                <input
                  type="text"
                  value={connectionForm.access_token}
                  onChange={(e) => setConnectionForm({ ...connectionForm, access_token: e.target.value })}
                  placeholder="Token akses API dari marketplace"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Refresh Token (Opsional)
                </label>
                <input
                  type="text"
                  value={connectionForm.refresh_token}
                  onChange={(e) => setConnectionForm({ ...connectionForm, refresh_token: e.target.value })}
                  placeholder="Token refresh untuk token akses otomatis"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsConnectionModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 disabled:bg-slate-300 dark:disabled:bg-zinc-800 disabled:cursor-not-allowed transition-all"
                >
                  {loading ? 'Menambahkan...' : 'Tambah Koneksi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Mapping Modal */}
      {isMappingModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">
                {editingMapping ? 'Edit Mapping SKU' : 'Tambah Mapping SKU'}
              </h2>
              <button
                onClick={() => {
                  setIsMappingModalOpen(false)
                  setEditingMapping(null)
                }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <form onSubmit={handleAddMapping} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Produk Lokal
                </label>
                <select
                  value={mappingForm.product_id}
                  onChange={(e) => setMappingForm({ ...mappingForm, product_id: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                  disabled={!!editingMapping}
                >
                  <option value="">Pilih produk</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} - {product.sku} ({product.color} / {product.size})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Platform
                </label>
                <select
                  value={mappingForm.platform}
                  onChange={(e) => setMappingForm({ ...mappingForm, platform: e.target.value as any })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                  disabled={!!editingMapping}
                >
                  <option value="shopee">Shopee</option>
                  <option value="tokopedia">Tokopedia</option>
                  <option value="tiktok">TikTok Shop</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Marketplace Item ID
                </label>
                <input
                  type="text"
                  value={mappingForm.marketplace_item_id}
                  onChange={(e) => setMappingForm({ ...mappingForm, marketplace_item_id: e.target.value })}
                  placeholder="ID item dari marketplace"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                  disabled={!!editingMapping}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Variation ID (Opsional)
                </label>
                <input
                  type="text"
                  value={mappingForm.marketplace_variation_id}
                  onChange={(e) => setMappingForm({ ...mappingForm, marketplace_variation_id: e.target.value })}
                  placeholder="ID variasi jika produk memiliki variasi"
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  disabled={!!editingMapping}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">
                  Buffer Stock
                </label>
                <input
                  type="number"
                  min="0"
                  value={mappingForm.buffer_stock}
                  onChange={(e) => setMappingForm({ ...mappingForm, buffer_stock: parseInt(e.target.value) || 0 })}
                  className="w-full px-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  required
                />
                <p className="mt-2 text-xs text-slate-500 dark:text-zinc-400">
                  Stok buffer untuk mencegah overselling (default: 2)
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsMappingModalOpen(false)
                    setEditingMapping(null)
                  }}
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
      )}

      {/* Instructions */}
      <div className="mt-6 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Panduan Integrasi Marketplace</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• <strong>Buffer Stock</strong>: Stok buffer untuk mencegah overselling saat terjadi race condition</li>
          <li>• <strong>Mapping SKU</strong>: Hubungkan produk lokal dengan SKU marketplace untuk sinkronisasi otomatis</li>
          <li>• <strong>Webhook</strong>: Marketplace akan mengirim webhook ke endpoint `/api/webhooks/marketplace` saat ada order baru</li>
          <li>• <strong>Rate Limiting</strong>: Sistem secara otomatis membatasi kecepatan request ke marketplace (5 req/detik)</li>
          <li>• <strong>Atomic Operations</strong>: Proses pengurangan stok menggunakan row-level locking untuk mencegah race condition</li>
          <li>• <strong>Multi-Platform Sync</strong>: Stok akan disinkronkan ke semua marketplace yang terhubung secara otomatis</li>
        </ul>
      </div>
    </div>
  )
}