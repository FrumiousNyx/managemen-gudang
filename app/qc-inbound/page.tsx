'use client'

import { useEffect, useState } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { ShoppingCart, Plus, Search } from 'lucide-react'

export default function QCInbound() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
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
      showToast('error', 'Database connection not configured')
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
      showToast('error', 'Failed to load products')
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
      showToast('error', 'Database connection not configured')
      return
    }

    if (!selectedProduct) {
      showToast('error', 'Please select a product')
      return
    }

    const qty = parseInt(quantity)
    if (isNaN(qty) || qty <= 0) {
      showToast('error', 'Please enter a valid quantity')
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

      showToast('success', `Successfully added ${qty} units to ${selectedProduct.name}`)
      
      // Reset form
      setSelectedProduct(null)
      setQuantity('')
      setSearchTerm('')
      
      // Refresh products
      await fetchProducts()
    } catch (error) {
      console.error('Error adding stock:', error)
      showToast('error', 'Failed to add stock')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">QC Inbound</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400">Add products that passed quality control to warehouse stock</p>
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-8">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Product Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
              Select Product SKU
            </label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by Name, SKU, Color, or Size..."
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
              <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-4">Selected Product</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Name:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.name}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">SKU:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.sku}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Color:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.color}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Size:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.size}</span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Current Stock:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{selectedProduct.stock}</span>
                </div>
              </div>
            </div>
          )}

          {/* Quantity Input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
              Quantity (Actual QC Pass Count)
            </label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Enter quantity..."
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
                Processing...
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
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Instructions</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• Search and select the product SKU from the dropdown</li>
          <li>• Enter the actual count of items that passed QC</li>
          <li>• Click "Tambah Stok Gudang" to add stock to the warehouse</li>
          <li>• The transaction will be logged in the inventory audit trail</li>
        </ul>
      </div>
    </div>
  )
}