'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    // Check for admin session in localStorage
    const adminSession = localStorage.getItem('admin_session')
    const adminTimestamp = localStorage.getItem('admin_timestamp')
    
    // Check if admin session is valid (24 hours)
    if (adminSession === 'true' && adminTimestamp) {
      const timestamp = parseInt(adminTimestamp)
      const hoursSinceLogin = (Date.now() - timestamp) / (1000 * 60 * 60)
      
      if (hoursSinceLogin < 24) {
        setIsAdmin(true)
        setLoading(false)
        return
      } else {
        // Clear expired admin session
        localStorage.removeItem('admin_session')
        localStorage.removeItem('admin_timestamp')
      }
    }

    if (!supabase) {
      setLoading(false)
      return
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string) => {
    if (!supabase) {
      return { error: new Error('Supabase not initialized') }
    }
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signOut = async () => {
    // Clear admin session
    localStorage.removeItem('admin_session')
    localStorage.removeItem('admin_timestamp')
    document.cookie = 'admin_session=; path=/; max-age=0'
    setIsAdmin(false)
    
    // Clear Supabase session
    if (!supabase) return
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
