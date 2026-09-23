'use client'

import { useAuth } from '@/contexts/auth-context'
import { Shield } from 'lucide-react'

interface AdminGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function AdminGuard({ children, fallback }: AdminGuardProps) {
  const { isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-zinc-800 border-t-slate-900 dark:border-t-zinc-100"></div>
      </div>
    )
  }

  if (!isAdmin) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className="flex items-center justify-center min-h-[200px] p-8">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-2">
            Akses Ditolak
          </h3>
          <p className="text-slate-600 dark:text-zinc-400">
            Fitur ini hanya dapat diakses oleh admin
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

interface StaffGuardProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

export function StaffGuard({ children, fallback }: StaffGuardProps) {
  const { isStaff, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-slate-200 dark:border-zinc-800 border-t-slate-900 dark:border-t-zinc-100"></div>
      </div>
    )
  }

  if (!isStaff) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className="flex items-center justify-center min-h-[200px] p-8">
        <div className="text-center">
          <Shield className="h-12 w-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 dark:text-zinc-100 mb-2">
            Akses Ditolak
          </h3>
          <p className="text-slate-600 dark:text-zinc-400">
            Fitur ini memerlukan akses staff atau admin
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
