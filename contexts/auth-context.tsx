'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AppUser {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'staff' | 'viewer'
  is_active: boolean
}

interface AuthContextType {
  user: User | null
  appUser: AppUser | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  isStaff: boolean
  isViewer: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [appUser, setAppUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Calculate user roles
  const isAdmin = appUser?.role === 'admin'
  const isStaff = appUser?.role === 'staff' || isAdmin
  const isViewer = appUser?.role === 'viewer' || isStaff || isAdmin

  useEffect(() => {
    console.log('AuthContext: Checking for session in localStorage')
    
    // Check for session in localStorage (custom authentication)
    const userEmail = localStorage.getItem('user_email')
    const userRole = localStorage.getItem('user_role')
    const userName = localStorage.getItem('user_name')
    const loginTimestamp = localStorage.getItem('login_timestamp')

    console.log('AuthContext: Found session data:', { userEmail, userRole, userName })

    if (userEmail && userRole && userName) {
      // Check if session is valid (24 hours)
      const timestamp = parseInt(loginTimestamp || '0')
      const hoursSinceLogin = (Date.now() - timestamp) / (1000 * 60 * 60)
      
      console.log('AuthContext: Hours since login:', hoursSinceLogin)
      
      if (hoursSinceLogin < 24) {
        // Session is valid
        console.log('AuthContext: Session is valid, setting appUser')
        setAppUser({
          id: 'custom-user',
          email: userEmail,
          full_name: userName,
          role: userRole as 'admin' | 'staff' | 'viewer',
          is_active: true
        })
        setLoading(false)
        return
      } else {
        // Session expired
        console.log('AuthContext: Session expired, clearing localStorage')
        localStorage.removeItem('user_email')
        localStorage.removeItem('user_role')
        localStorage.removeItem('user_name')
        localStorage.removeItem('login_timestamp')
      }
    }

    console.log('AuthContext: No valid session found')
    setLoading(false)
  }, [])

  const signIn = async (email: string, password: string) => {
    // This is now handled in the login page
    return { error: null }
  }

  const signOut = async () => {
    console.log('AuthContext: Signing out')
    // Clear custom session
    localStorage.removeItem('user_email')
    localStorage.removeItem('user_role')
    localStorage.removeItem('user_name')
    localStorage.removeItem('login_timestamp')
    
    // Clear the session cookie
    document.cookie = 'user_session=; path=/; max-age=0'
    
    setAppUser(null)
    setUser(null)
    setSession(null)
    
    // Force reload to clear any cached state
    window.location.href = '/login'
  }

  const refreshUser = async () => {
    // Refresh logic if needed
  }

  return (
    <AuthContext.Provider value={{ user, appUser, session, loading, isAdmin, isStaff, isViewer, signIn, signOut, refreshUser }}>
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
