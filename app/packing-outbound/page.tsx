'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Product } from '@/lib/supabase'
import { useToast } from '@/components/toast-provider'
import { Scan, Package, AlertCircle, CheckCircle, XCircle, Layers, Zap } from 'lucide-react'

type ScanMode = 'single' | 'bulk'

interface ScannedItem {
  product: Product
  quantity: number
  timestamp: Date
}

export default function PackingOutbound() {
  const [barcodeInput, setBarcodeInput] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [scanMode, setScanMode] = useState<ScanMode>('single')
  const [recentlyScanned, setRecentlyScanned] = useState<ScannedItem[]>([])
  const [errorMessage, setErrorMessage] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const quantityRef = useRef<HTMLInputElement>(null)
  const { showToast } = useToast()

  // Auto-focus input on mount and when clicked outside
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }

    const handleFocus = (e: MouseEvent) => {
      // Don't refocus if clicking on the quantity input in bulk mode
      if (quantityRef.current && e.target === quantityRef.current) return
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }

    document.addEventListener('click', handleFocus)
    return () => document.removeEventListener('click', handleFocus)
  }, [])

  // Reset quantity to 1 when switching to single mode
  useEffect(() => {
    if (scanMode === 'single') {
      setQuantity('1')
    }
  }, [scanMode])

  // Play success beep sound
  const playSuccessSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      gainNode.gain.value = 0.1
      
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.error('Error playing success sound:', error)
    }
  }

  // Play error sound
  const playErrorSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 200
      oscillator.type = 'sawtooth'
      gainNode.gain.value = 0.1
      
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.2)
    } catch (error) {
      console.error('Error playing error sound:', error)
    }
  }

  const handleBarcodeScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && barcodeInput.trim()) {
      e.preventDefault()
      const sku = barcodeInput.trim()
      const qty = parseInt(quantity) || 1
      
      if (!supabase) {
        setErrorMessage('Koneksi database tidak dikonfigurasi')
        playErrorSound()
        showToast('error', 'Koneksi database tidak dikonfigurasi')
        setBarcodeInput('')
        if (inputRef.current) inputRef.current.focus()
        return
      }
      
      try {
        // Use atomic RPC function for safe stock deduction
        const { data: rpcResult, error: rpcError } = await supabase
          .rpc('deduct_product_stock', { 
            p_sku: sku, 
            p_qty: qty 
          })

        if (rpcError) throw rpcError

        if (!rpcResult?.success) {
          const errorMsg = rpcResult?.message || 'Error processing scan'
          const currentStock = rpcResult?.current_stock || 0
          
          if (errorMsg.includes('tidak ditemukan')) {
            setErrorMessage(`SKU Tidak Ditemukan: ${sku}`)
          } else if (errorMsg.includes('tidak mencukupi')) {
            setErrorMessage(`Stok Tidak Cukup! Sisa Stok: ${currentStock}`)
          } else {
            setErrorMessage(errorMsg)
          }
          
          playErrorSound()
          showToast('error', errorMsg)
          setBarcodeInput('')
          
          // Reset quantity to 1 in bulk mode after error
          if (scanMode === 'bulk') {
            setQuantity('1')
          }
          
          if (inputRef.current) inputRef.current.focus()
          return
        }

        // Get product details for display
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('sku', sku)
          .single()

        if (productError || !product) {
          setErrorMessage('Error mengambil detail produk')
          playErrorSound()
          setBarcodeInput('')
          if (inputRef.current) inputRef.current.focus()
          return
        }

        // Success
        playSuccessSound()
        const successText = qty === 1 
          ? `Berhasil: ${product.name} - ${product.color} (${product.size})`
          : `Berhasil: ${qty}x ${product.name} - ${product.color} (${product.size})`
        
        setSuccessMessage(successText)
        setErrorMessage('')
        
        // Add to recently scanned
        setRecentlyScanned((prev) => [
          { 
            product: { ...product, stock: rpcResult.remaining_stock || product.stock - qty }, 
            quantity: qty,
            timestamp: new Date() 
          },
          ...prev.slice(0, 9) // Keep only last 10 items
        ])

        showToast('success', `Scanned: ${qty}x ${product.name}`)
        setBarcodeInput('')
        
        // Reset quantity to 1 in bulk mode after successful scan
        if (scanMode === 'bulk') {
          setQuantity('1')
        }
        
        // Auto-focus for next scan
        if (inputRef.current) inputRef.current.focus()
        
        // Clear success message after 2 seconds
        setTimeout(() => setSuccessMessage(''), 2000)
      } catch (error) {
        console.error('Error processing scan:', error)
        setErrorMessage('Error memproses pindai')
        playErrorSound()
        showToast('error', 'Error memproses pindai')
        setBarcodeInput('')
        
        // Reset quantity to 1 in bulk mode after error
        if (scanMode === 'bulk') {
          setQuantity('1')
        }
        
        if (inputRef.current) inputRef.current.focus()
      }
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold text-slate-900 dark:text-zinc-100">Pengemasan</h1>
        <p className="mt-2 text-slate-500 dark:text-zinc-400">Pindai stiker barcode untuk mengurangi stok saat pengemasan</p>
      </div>

      {/* Mode Switcher */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100">Mode Pindai</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setScanMode('single')}
              className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all ${
                scanMode === 'single'
                  ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Zap className="h-4 w-4 mr-2" />
              Satu Pindai (-1)
            </button>
            <button
              onClick={() => setScanMode('bulk')}
              className={`flex items-center px-4 py-2 rounded-xl font-medium transition-all ${
                scanMode === 'bulk'
                  ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
              }`}
            >
              <Layers className="h-4 w-4 mr-2" />
              Banyak Pindai (-N)
            </button>
          </div>
        </div>

        {/* Barcode Scanner Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
            Input Pemindai Barcode
          </label>
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Scan className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                ref={inputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={handleBarcodeScan}
                placeholder="Pindai barcode di sini..."
                className="w-full pl-12 pr-4 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-lg"
                autoFocus
              />
            </div>
            
            {scanMode === 'bulk' && (
              <div className="w-28">
                <input
                  ref={quantityRef}
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="Qty"
                  className="w-full px-4 py-4 border-2 border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all text-lg text-center font-semibold"
                />
              </div>
            )}
          </div>
          <p className="mt-3 text-sm text-slate-500 dark:text-zinc-400">
            <Scan className="inline h-4 w-4 mr-1" />
            {scanMode === 'single' 
              ? 'Mode Satu Pindai: Setiap pindai mengurangi 1 unit dari stok. Cocok untuk pengemasan item individu.'
              : 'Mode Banyak Pindai: Masukkan jumlah, lalu pindai barcode sekali untuk mengurangi banyak unit. Reset ke 1 setelah setiap pindai.'}
          </p>
        </div>

        {/* Status Messages - Large indicators for warehouse staff */}
        {errorMessage && (
          <div className="bg-red-50 dark:bg-red-950 border-2 border-red-200 dark:border-red-900 rounded-2xl p-6 flex items-center animate-pulse">
            <div className="h-12 w-12 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center mr-4">
              <XCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
            </div>
            <p className="text-xl font-semibold text-red-900 dark:text-red-100">{errorMessage}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 dark:bg-emerald-950 border-2 border-emerald-200 dark:border-emerald-900 rounded-2xl p-6 flex items-center">
            <div className="h-12 w-12 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center mr-4">
              <CheckCircle className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">{successMessage}</p>
          </div>
        )}
      </div>

      {/* Recently Scanned Items */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-4 flex items-center">
          <Package className="h-5 w-5 mr-2" />
          Item yang Baru Dipindai
        </h2>
        
        {recentlyScanned.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-zinc-400">
            <Scan className="h-16 w-16 mx-auto mb-4 text-slate-300 dark:text-zinc-700" />
            <p className="text-lg">Belum ada item yang dipindai. Mulai pindai untuk melihat item di sini.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentlyScanned.map((item, index) => (
              <div
                key={`${item.product.id}-${index}`}
                className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl border border-slate-200 dark:border-zinc-800"
              >
                <div className="flex-1">
                  <div className="font-medium text-slate-900 dark:text-zinc-100">
                    {item.quantity > 1 && `${item.quantity}x `}
                    {item.product.name}
                  </div>
                  <div className="text-sm text-slate-500 dark:text-zinc-400 mt-1">
                    SKU: {item.product.sku} | {item.product.color} | Size: {item.product.size}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                    Stock: {item.product.stock}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-zinc-400">{formatTime(item.timestamp)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="mt-6 bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-6">
        <h3 className="font-semibold text-slate-900 dark:text-zinc-100 mb-3">Instruksi</h3>
        <ul className="text-sm text-slate-600 dark:text-zinc-400 space-y-2">
          <li>• Pastikan pemindai barcode Anda terhubung dan berfungsi</li>
          <li>• <strong>Mode Satu Pindai:</strong> Pindai setiap barcode secara individu untuk pengurangan 1 unit</li>
          <li>• <strong>Mode Banyak Pindai:</strong> Masukkan jumlah terlebih dahulu, lalu pindai barcode sekali untuk banyak unit</li>
          <li>• Jumlah otomatis reset ke 1 setelah setiap pindai banyak untuk mencegah kesalahan</li>
          <li>• Validasi stok mencegah overselling dengan pesan error yang jelas</li>
          <li>• Operasi database atomik mencegah race condition di lingkungan multi-user</li>
          <li>• Feedback audio mengkonfirmasi pindai berhasil dan memberi peringatan untuk error</li>
          <li>• Input otomatis fokus kembali untuk pindai berkelanjutan</li>
        </ul>
      </div>
    </div>
  )
}