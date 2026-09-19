'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, X } from 'lucide-react'

interface Product {
  id: string
  sku: string
  name: string
  color: string
  size: string
}

interface ProductSearchProps {
  onSelect: (product: Product) => void
  placeholder?: string
  className?: string
}

export function ProductSearch({ onSelect, placeholder = 'Cari SKU atau nama produk...', className = '' }: ProductSearchProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Product[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const searchProducts = async () => {
      if (!query || query.length < 2) {
        setSuggestions([])
        setIsOpen(false)
        return
      }

      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('products')
          .select('id, sku, name, color, size')
          .or(`sku.ilike.%${query}%,name.ilike.%${query}%`)
          .limit(10)

        if (error) throw error
        setSuggestions(data || [])
        setIsOpen(true)
      } catch (error) {
        console.error('Error searching products:', error)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }

    const debounceTimer = setTimeout(searchProducts, 300)
    return () => clearTimeout(debounceTimer)
  }, [query])

  const handleSelect = (product: Product) => {
    setQuery(`${product.sku} - ${product.name}`)
    onSelect(product)
    setIsOpen(false)
    setSuggestions([])
  }

  const handleClear = () => {
    setQuery('')
    setSuggestions([])
    setIsOpen(false)
  }

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query && query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-slate-500 dark:text-zinc-400">
              Mencari...
            </div>
          ) : (
            suggestions.map((product) => (
              <button
                key={product.id}
                onClick={() => handleSelect(product)}
                className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-100 dark:border-zinc-800 last:border-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-slate-900 dark:text-zinc-100">{product.sku}</p>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">{product.name}</p>
                  </div>
                  <div className="text-right text-sm text-slate-500 dark:text-zinc-400">
                    <p>{product.color}</p>
                    <p>{product.size}</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {isOpen && !loading && suggestions.length === 0 && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-lg p-4 text-center text-slate-500 dark:text-zinc-400">
          Tidak ada produk ditemukan
        </div>
      )}
    </div>
  )
}
