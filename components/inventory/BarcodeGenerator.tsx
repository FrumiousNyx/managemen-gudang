'use client'

import { useEffect, useRef, useState } from 'react'
import { Printer, Barcode as BarcodeIcon } from 'lucide-react'
import JsBarcode from 'jsbarcode'

interface BarcodeGeneratorProps {
  value: string
  productName?: string
  price?: number
  size?: string
  color?: string
  showPreview?: boolean
  className?: string
}

interface BarcodePrintOptions {
  labelWidth: number
  labelHeight: number
  includePrice: boolean
  includeSize: boolean
  includeColor: boolean
}

export default function BarcodeGenerator({
  value,
  productName = '',
  price,
  size = '',
  color = '',
  showPreview = true,
  className = ''
}: BarcodeGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [printOptions, setPrintOptions] = useState<BarcodePrintOptions>({
    labelWidth: 50, // mm
    labelHeight: 30, // mm
    includePrice: true,
    includeSize: true,
    includeColor: true
  })
  const [showPrintModal, setShowPrintModal] = useState(false)

  // Generate barcode whenever value changes
  useEffect(() => {
    if (!value || !canvasRef.current) return

    setIsGenerating(true)
    
    try {
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      
      if (!context) return

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height)

      // Generate barcode using JsBarcode
      JsBarcode(canvas, value, {
        format: 'CODE128',
        width: 2,
        height: 60,
        displayValue: true,
        fontSize: 14,
        font: 'monospace',
        textMargin: 4,
        margin: 10,
        background: '#ffffff',
        lineColor: '#000000',
        valid: (valid) => {
          if (!valid) {
            console.error('Invalid barcode value:', value)
          }
        }
      })

      setIsGenerating(false)
    } catch (error) {
      console.error('Barcode generation error:', error)
      setIsGenerating(false)
    }
  }, [value])

  const printLabel = () => {
    if (!canvasRef.current || !value) return

    try {
      const canvas = canvasRef.current
      const dataUrl = canvas.toDataURL('image/png')

      // Create print window
      const printWindow = window.open('', '_blank')
      if (!printWindow) return

      const barcodeImage = dataUrl
      const priceText = price ? `Rp ${price.toLocaleString('id-ID')}` : ''
      const sizeText = printOptions.includeSize ? size : ''
      const colorText = printOptions.includeColor ? color : ''

      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Barcode Label - ${value}</title>
          <style>
            @page {
              size: ${printOptions.labelWidth}mm ${printOptions.labelHeight}mm;
              margin: 0;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            body {
              width: ${printOptions.labelWidth}mm;
              height: ${printOptions.labelHeight}mm;
              background: #fff;
              color: #000;
              font-family: Arial, sans-serif;
              overflow: hidden;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 2mm;
            }
            .barcode-container {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 1mm 0;
            }
            .barcode-container img {
              max-width: 100%;
              height: auto;
            }
            .product-name {
              font-size: 8px;
              font-weight: bold;
              text-align: center;
              line-height: 1.1;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              max-width: 100%;
              margin-bottom: 0.5mm;
            }
            .product-details {
              font-size: 6px;
              text-align: center;
              line-height: 1;
              margin-bottom: 0.5mm;
            }
            .price {
              font-size: 7px;
              font-weight: bold;
              text-align: center;
              margin-top: 0.5mm;
            }
            .sku {
              font-size: 7px;
              font-family: 'Courier New', monospace;
              font-weight: bold;
              text-align: center;
              margin-top: 0.5mm;
            }
          </style>
        </head>
        <body>
          <div class="product-name">${productName || 'TENZE INVENTORY'}</div>
          <div class="barcode-container">
            <img src="${barcodeImage}" alt="Barcode" />
          </div>
          ${sizeText || colorText ? `<div class="product-details">${sizeText}${sizeText && colorText ? ' / ' : ''}${colorText}</div>` : ''}
          ${printOptions.includePrice && price ? `<div class="price">${priceText}</div>` : ''}
          <div class="sku">${value}</div>
          <script>
            window.onload = function() {
              window.focus();
              window.print();
            };
          </script>
        </body>
        </html>
      `)
      printWindow.document.close()
    } catch (error) {
      console.error('Print error:', error)
    }
  }

  if (!showPreview) {
    return null
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Barcode Preview */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarcodeIcon className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
            <h3 className="font-semibold text-slate-900 dark:text-zinc-100">Barcode Preview</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowPrintModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 rounded-lg text-sm text-white dark:text-zinc-900 transition-colors"
              title="Print Label"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        </div>

        {/* Canvas for barcode generation */}
        <div className="flex justify-center items-center bg-slate-50 dark:bg-zinc-950 rounded-lg p-4 min-h-[120px]">
          {value ? (
            <canvas
              ref={canvasRef}
              width={300}
              height={120}
              className="max-w-full h-auto"
            />
          ) : (
            <div className="text-slate-400 dark:text-zinc-500 text-sm">
              Masukkan SKU untuk generate barcode
            </div>
          )}
        </div>

        {/* Product info display */}
        {productName && (
          <div className="mt-4 p-3 bg-slate-50 dark:bg-zinc-950 rounded-lg">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500 dark:text-zinc-400">Nama:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{productName}</span>
              </div>
              <div>
                <span className="text-slate-500 dark:text-zinc-400">SKU:</span>
                <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{value}</span>
              </div>
              {size && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Ukuran:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{size}</span>
                </div>
              )}
              {color && (
                <div>
                  <span className="text-slate-500 dark:text-zinc-400">Warna:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">{color}</span>
                </div>
              )}
              {price && (
                <div className="col-span-2">
                  <span className="text-slate-500 dark:text-zinc-400">Harga:</span>
                  <span className="ml-2 font-medium text-slate-900 dark:text-zinc-100">Rp {price.toLocaleString('id-ID')}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Print Options Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto border border-slate-200 dark:border-zinc-800">
            <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-zinc-800">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-zinc-100">Print Settings</h2>
              <button
                onClick={() => setShowPrintModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
              >
                <BarcodeIcon className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Label Size */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
                  Ukuran Label
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Lebar (mm)</label>
                    <input
                      type="number"
                      value={printOptions.labelWidth}
                      onChange={(e) => setPrintOptions({...printOptions, labelWidth: parseInt(e.target.value) || 50})}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 dark:text-zinc-400 mb-1">Tinggi (mm)</label>
                    <input
                      type="number"
                      value={printOptions.labelHeight}
                      onChange={(e) => setPrintOptions({...printOptions, labelHeight: parseInt(e.target.value) || 30})}
                      className="w-full px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Label Content */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
                  Konten Label
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={printOptions.includePrice}
                      onChange={(e) => setPrintOptions({...printOptions, includePrice: e.target.checked})}
                      className="w-4 h-4 text-slate-900 dark:text-zinc-100 rounded border-slate-300 dark:border-zinc-700 focus:ring-slate-900 dark:focus:ring-zinc-100"
                    />
                    <span className="text-sm text-slate-700 dark:text-zinc-300">Harga</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={printOptions.includeSize}
                      onChange={(e) => setPrintOptions({...printOptions, includeSize: e.target.checked})}
                      className="w-4 h-4 text-slate-900 dark:text-zinc-100 rounded border-slate-300 dark:border-zinc-700 focus:ring-slate-900 dark:focus:ring-zinc-100"
                    />
                    <span className="text-sm text-slate-700 dark:text-zinc-300">Ukuran</span>
                  </label>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={printOptions.includeColor}
                      onChange={(e) => setPrintOptions({...printOptions, includeColor: e.target.checked})}
                      className="w-4 h-4 text-slate-900 dark:text-zinc-100 rounded border-slate-300 dark:border-zinc-700 focus:ring-slate-900 dark:focus:ring-zinc-100"
                    />
                    <span className="text-sm text-slate-700 dark:text-zinc-300">Warna</span>
                  </label>
                </div>
              </div>

              {/* Preset Sizes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-3">
                  Ukuran Preset
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setPrintOptions({...printOptions, labelWidth: 50, labelHeight: 30})}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      printOptions.labelWidth === 50 && printOptions.labelHeight === 30
                        ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    50x30mm
                  </button>
                  <button
                    onClick={() => setPrintOptions({...printOptions, labelWidth: 60, labelHeight: 40})}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      printOptions.labelWidth === 60 && printOptions.labelHeight === 40
                        ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    60x40mm
                  </button>
                  <button
                    onClick={() => setPrintOptions({...printOptions, labelWidth: 100, labelHeight: 50})}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      printOptions.labelWidth === 100 && printOptions.labelHeight === 50
                        ? 'bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                        : 'bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                    }`}
                  >
                    100x50mm
                  </button>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowPrintModal(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 font-medium rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    printLabel()
                    setShowPrintModal(false)
                  }}
                  className="flex-1 px-4 py-3 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all flex items-center justify-center"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Print Label
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}