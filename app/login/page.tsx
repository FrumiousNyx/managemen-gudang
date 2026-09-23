'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Lock, Mail, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!supabase) {
        setError('Database tidak tersedia')
        setLoading(false)
        return
      }

      console.log('Attempting login for:', email)

      // Check if user exists in our users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single()

      console.log('User data:', userData)
      console.log('User error:', userError)

      if (userError || !userData) {
        console.error('User not found or error:', userError)
        setError('Email atau password salah')
        setLoading(false)
        return
      }

      if (!userData.is_active) {
        setError('Akun Anda dinonaktifkan. Hubungi admin.')
        setLoading(false)
        return
      }

      // Check password
      if (userData.password_hash !== password) {
        console.error('Password mismatch')
        setError('Email atau password salah')
        setLoading(false)
        return
      }

      console.log('Login successful, setting session...')

      // Set user session using localStorage
      localStorage.setItem('user_email', email)
      localStorage.setItem('user_role', userData.role)
      localStorage.setItem('user_name', userData.full_name)
      localStorage.setItem('login_timestamp', Date.now().toString())

      // Set a cookie for middleware to check (expires in 24 hours)
      document.cookie = 'user_session=true; path=/; max-age=86400'

      console.log('Session set, redirecting...')

      // Force page reload to ensure auth context picks up the session
      window.location.href = '/'
    } catch (err: any) {
      console.error('Login error:', err)
      setError('Terjadi kesalahan: ' + (err.message || 'Unknown error'))
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-800 px-4">
      <div className="max-w-md w-full">
        <div className="bg-white dark:bg-zinc-800 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-sm p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-slate-100 dark:bg-zinc-800 mb-4">
              <Lock className="h-8 w-8 text-slate-600 dark:text-zinc-400" />
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-zinc-100">
              Login
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-zinc-400">
              Masuk untuk mengakses sistem inventaris
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                Email / Username
              </label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-zinc-400 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-slate-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 placeholder-slate-400 dark:placeholder-zinc-500 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:border-transparent transition-all"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-800 font-medium rounded-xl hover:bg-slate-800 dark:hover:bg-zinc-200 focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Memproses...' : 'Masuk'}
            </button>
          </form>


        </div>
      </div>
    </div>
  )
}
