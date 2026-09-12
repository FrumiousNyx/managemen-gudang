'use client'

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff, Scan, X } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (decodedText: string) => void
  onClose: () => void
  enabled?: boolean
}

type ScanStatus = 'idle' | 'scanning' | 'detected' | 'error'

export default function BarcodeScanner({ onScan, onClose, enabled = true }: BarcodeScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [detectedCode, setDetectedCode] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const isProcessing = useRef(false)

  // Initialize scanner
  useEffect(() => {
    if (!enabled || !containerRef.current) return

    const scanner = new Html5Qrcode("barcode-scanner-reader")
    scannerRef.current = scanner

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [enabled])

  // Handle camera toggle
  const toggleCamera = async () => {
    if (isCameraActive) {
      await stopCamera()
    } else {
      await startCamera()
    }
  }

  const startCamera = async () => {
    if (!scannerRef.current || !containerRef.current) return

    setScanStatus('scanning')
    setErrorMessage('')

    try {
      const config = {
        fps: 10,
        qrbox: { width: 400, height: 120 }, // Horizontal rectangle for 1D barcodes
        aspectRatio: 3.33 // 3:1 ratio
      }

      await scannerRef.current.start(
        { facingMode: "environment" },
        config,
        handleScanSuccess,
        handleScanFailure
      )

      setIsCameraActive(true)
    } catch (error) {
      console.error('Camera start error:', error)
      setErrorMessage('Gagal mengakses kamera. Pastikan izin kamera diberikan.')
      setScanStatus('error')
      setIsCameraActive(false)
    }
  }

  const stopCamera = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop()
      } catch (error) {
        console.error('Camera stop error:', error)
      }
    }
    setIsCameraActive(false)
    setScanStatus('idle')
    setDetectedCode('')
  }

  const handleScanSuccess = (decodedText: string) => {
    if (isProcessing.current) return
    isProcessing.current = true

    // Haptic feedback
    if (navigator.vibrate) {
      navigator.vibrate(50)
    }

    // Audio beep
    playSuccessBeep()

    setDetectedCode(decodedText)
    setScanStatus('detected')

    // Trigger scan callback
    onScan(decodedText)

    // Reset processing after delay
    setTimeout(() => {
      isProcessing.current = false
      setScanStatus('scanning')
      setDetectedCode('')
    }, 2000)
  }

  const handleScanFailure = (error: string) => {
    // Ignore continuous scan failures (normal during scanning)
    if (!error.includes('No barcode')) {
      console.debug('Scan failure:', error)
    }
  }

  const playSuccessBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 1200
      oscillator.type = 'sine'
      gainNode.gain.value = 0.1
      
      oscillator.start()
      oscillator.stop(audioContext.currentTime + 0.1)
    } catch (error) {
      console.error('Audio beep error:', error)
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error)
      }
    }
  }, [])

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <Scan className="h-5 w-5 text-slate-600 dark:text-zinc-400" />
          <h3 className="font-semibold text-slate-900 dark:text-zinc-100">Barcode Scanner</h3>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Scanner Container */}
      <div className="p-4">
        <div 
          ref={containerRef}
          className="relative bg-black rounded-xl overflow-hidden"
          style={{ minHeight: '280px' }}
        >
          {/* Scanner Reader */}
          <div id="barcode-scanner-reader" className="w-full h-full" />

          {/* Custom Viewfinder Overlay */}
          {isCameraActive && (
            <div className="absolute inset-0 pointer-events-none">
              {/* Horizontal scanning zone */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[120px] border-2 border-white/50 rounded-lg">
                {/* Corner reticles */}
                <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 transition-colors ${
                  scanStatus === 'detected' ? 'border-green-500' : 'border-red-500'
                }`} />
                <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 transition-colors ${
                  scanStatus === 'detected' ? 'border-green-500' : 'border-red-500'
                }`} />
                <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 transition-colors ${
                  scanStatus === 'detected' ? 'border-green-500' : 'border-red-500'
                }`} />
                <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 transition-colors ${
                  scanStatus === 'detected' ? 'border-green-500' : 'border-red-500'
                }`} />

                {/* Scanning laser line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_10px_#ef4444] animate-pulse" />
              </div>

              {/* Status indicator */}
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  scanStatus === 'scanning' ? 'bg-green-500 animate-pulse' :
                  scanStatus === 'detected' ? 'bg-green-500' :
                  scanStatus === 'error' ? 'bg-red-500' : 'bg-slate-500'
                }`} />
                <span className="text-white text-xs font-medium">
                  {scanStatus === 'scanning' ? 'Scanning...' :
                   scanStatus === 'detected' ? 'Detected!' :
                   scanStatus === 'error' ? 'Error' : 'Idle'}
                </span>
              </div>
            </div>
          )}

          {/* Placeholder when camera inactive */}
          {!isCameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 dark:bg-zinc-950">
              <Camera className="h-16 w-16 text-slate-600 dark:text-zinc-400 mb-4" />
              <p className="text-slate-400 dark:text-zinc-500 text-center px-4">
                Kamera non-aktif. Aktifkan untuk memindai barcode.
              </p>
            </div>
          )}
        </div>

        {/* Detected code display */}
        {detectedCode && (
          <div className="mt-4 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-900 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 dark:text-green-300">Barcode Terdeteksi</p>
                <p className="text-lg font-bold text-green-900 dark:text-green-200 mt-1">{detectedCode}</p>
              </div>
              <div className="h-8 w-8 rounded-full bg-green-500 flex items-center justify-center">
                <Scan className="h-4 w-4 text-white" />
              </div>
            </div>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-xl">
            <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
          </div>
        )}

        {/* Camera control button */}
        <button
          onClick={toggleCamera}
          className={`w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition-all ${
            isCameraActive
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-slate-900 dark:bg-zinc-100 hover:bg-slate-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900'
          }`}
        >
          {isCameraActive ? (
            <>
              <CameraOff className="h-5 w-5" />
              Matikan Kamera
            </>
          ) : (
            <>
              <Camera className="h-5 w-5" />
              Aktifkan Kamera
            </>
          )}
        </button>

        {/* Instructions */}
        <div className="mt-4 p-4 bg-slate-50 dark:bg-zinc-950 rounded-xl">
          <h4 className="font-medium text-slate-900 dark:text-zinc-100 mb-2">Format yang Didukung</h4>
          <div className="flex flex-wrap gap-2">
            {['Code 128', 'EAN-13', 'EAN-8', 'UPC-A', 'Code 39', 'Code 93'].map((format) => (
              <span
                key={format}
                className="px-2 py-1 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-lg text-xs text-slate-600 dark:text-zinc-400"
              >
                {format}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
            Scanner dioptimalkan untuk barcode 1D linear pada label pakaian.
          </p>
        </div>
      </div>
    </div>
  )
}