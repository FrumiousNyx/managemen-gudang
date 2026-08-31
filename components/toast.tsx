'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle, AlertCircle, XCircle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface ToastProps {
  type?: ToastType
  message: string
  duration?: number
  onClose?: () => void
}

export function Toast({ type = 'info', message, duration = 3000, onClose }: ToastProps) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false)
      onClose?.()
    }, duration)

    return () => clearTimeout(timer)
  }, [duration, onClose])

  if (!isVisible) return null

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />,
    error: <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    info: <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
  }

  const bgColors = {
    success: 'bg-white dark:bg-zinc-900 border-emerald-200 dark:border-emerald-800',
    error: 'bg-white dark:bg-zinc-900 border-red-200 dark:border-red-800',
    warning: 'bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-800',
    info: 'bg-white dark:bg-zinc-900 border-blue-200 dark:border-blue-800',
  }

  return (
    <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl border shadow-sm ${bgColors[type]} flex items-center gap-3 transition-all duration-300`}>
      {icons[type]}
      <p className="text-sm font-medium text-slate-900 dark:text-zinc-100">{message}</p>
      <button
        onClick={() => {
          setIsVisible(false)
          onClose?.()
        }}
        className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}