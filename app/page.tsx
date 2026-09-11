'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { getStockStatus, isLowStock } from '@/lib/stock-utils'
import { subscribeToProducts, unsubscribeFromChannel } from '@/lib/realtime'
import { Search, Package, AlertTriangle, CheckCircle } from 'lucide-react'
import { DashboardSkeleton } from '@/components/skeleton'

export default function Dashboard() {
  const [products, setProducts] = useState<Product[]>([])
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()

    // Subscribe to real-time product updates
    const subscription = subscribeToProducts(() => {
      fetchProducts()
    })

    return () => {
      if (subscription) {
        unsubscribeFromChannel(subscription)
      }
    }
  }, [])

  useEffect(() => {
    const filtered = products.filter(
      (product) =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.color.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.size.toLowerCase().includes(searchTerm.toLowerCase())
    )
    setFilteredProducts(filtered)
  }, [searchTerm, products])

  const fetchProducts = async () => {
    if (!supabase) {
      console.error('Supabase client not initialized')
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setProducts(data || [])
      setFilteredProducts(data || [])
    } catch (error) {
      console.error('Error fetching products:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalSKUs = products.length
  const totalStock = products.reduce((sum, p) => sum + p.stock, 0)
  const lowStockCount = products.filter((p) => isLowStock(p)).length

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-zinc-100">Dasbor Stok</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400 text-sm sm:text-base">Pantau level stok secara real-time</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Jenis SKU</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalSKUs}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
              <Package className="h-6 w-6 text-slate-600 dark:text-zinc-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Total Unit dalam Stok</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{totalStock}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center">
              <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-zinc-400">Peringatan Stok Rendah</p>
              <p className="text-4xl font-bold text-slate-900 dark:text-zinc-100 mt-2">{lowStockCount}</p>
            </div>
            <div className="h-12 w-12 rounded-xl bg-amber-50 dark:bg-amber-950 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nama, SKU, Warna, atau Ukuran..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
          />
        </div>
      </div>

      {/* Data Table - Desktop */}
      <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-zinc-800">
            <thead className="bg-slate-50 dark:bg-zinc-950">
              <tr>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  SKU
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
                  Sisa Stok
                </th>
                <th className="px-4 py-3.5 text-left text-xs font-medium text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-zinc-900 divide-y divide-slate-200 dark:divide-zinc-800">
              {filteredProducts.map((product) => {
                const status = getStockStatus(product)
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
                  </tr>
                )
              })}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-slate-500 dark:text-zinc-400">
                    Tidak ada produk yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-3">
        {filteredProducts.map((product) => {
          const status = getStockStatus(product)
          return (
            <div key={product.id} className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900 dark:text-zinc-100">{product.name}</p>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">{product.sku}</p>
                </div>
                <span className={`px-2.5 py-0.5 inline-flex text-xs font-medium rounded-full border ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
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
            </div>
          )
        })}
        {filteredProducts.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-12 text-center text-slate-500 dark:text-zinc-400">
            Tidak ada produk yang cocok dengan pencarian Anda.
          </div>
        )}
      </div>
    </div>
  )
}
