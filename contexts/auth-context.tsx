'use client'

import { createContext, useContext, useEffect, useState } from 'react'

interface AuthContextType {
  user: any
  loading: boolean
  signOut: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Check for session cookie
    const hasSession = document.cookie.includes('sb-access-token=admin')
    setUser(hasSession ? { email: 'admin' } : null)
    setLoading(false)
  }, [])

  const signOut = () => {
    // Clear session cookies
    document.cookie = 'sb-access-token=; path=/; max-age=0'
    document.cookie = 'sb-refresh-token=; path=/; max-age=0'
    setUser(null)
    window.location.href = '/login'
  }

  return (
    <AuthContext.Provider value={{ user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context as AuthContextType
}
