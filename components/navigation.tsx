'use client'

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Package, Scan, ShoppingCart, BarChart3, Menu, X, Clock, TrendingUp, LogOut, Moon, Sun, RotateCcw, Bell, Users, AlertTriangle } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { useTheme } from "@/contexts/theme-context"
import { supabase } from "@/lib/supabase"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, loading, isAdmin, isStaff } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [outOfStockCount, setOutOfStockCount] = useState(0)
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([])
  
  const navItems = [
    { href: "/", label: "Dasbor Stok", icon: BarChart3, requireRole: 'viewer' },
    { href: "/qc-inbound", label: "Barang Masuk", icon: ShoppingCart, requireRole: 'staff' },
    { href: "/packing-outbound", label: "Barang Keluar", icon: Scan, requireRole: 'staff' },
    { href: "/returns", label: "Retur & Rusak", icon: RotateCcw, requireRole: 'staff' },
    { href: "/history", label: "Riwayat", icon: Clock, requireRole: 'viewer' },
    { href: "/analytics", label: "Analitik", icon: TrendingUp, requireRole: 'viewer' },
    { href: "/products", label: "Produk", icon: Package, requireRole: 'staff' },
    { href: "/users", label: "Pengguna", icon: Users, requireRole: 'admin' },
  ]

  useEffect(() => {
    if (!supabase) return
    
    const fetchLowStockProducts = async () => {
      try {
        if (!supabase) return

        const { data, error } = await supabase
          .from('products')
          .select('*')
          .lt('stock', 40) // Low stock threshold
          .order('stock', { ascending: true })
          .limit(10)

        if (error) throw error
        
        const outOfStock = data?.filter(p => p.stock === 0).length || 0
        setOutOfStockCount(outOfStock)
        setLowStockProducts(data || [])
      } catch (error) {
        console.error('Error fetching low stock products:', error)
      }
    }

    fetchLowStockProducts()

    // Set up real-time subscription for products
    const subscription = supabase
      .channel('products-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        fetchLowStockProducts()
      })
      .subscribe()

    return () => {
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const navElement = document.querySelector('nav')
      
      if (isMobileMenuOpen && navElement && !navElement.contains(target)) {
        setIsMobileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isMobileMenuOpen])

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false)
  }, [pathname])

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  // Filter nav items based on user role
  const filteredNavItems = navItems.filter(item => {
    if (!item.requireRole) return true
    if (item.requireRole === 'admin') return isAdmin
    if (item.requireRole === 'staff') return isStaff
    if (item.requireRole === 'viewer') return true // Everyone can view
    return false
  })

  // Don't show navigation on login page
  if (pathname === '/login') {
    return null
  }

  // Show loading state while checking authentication
  if (loading) {
    return (
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Package className="h-7 w-7 text-slate-900 dark:text-zinc-100" />
              <span className="ml-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">Sistem Inventaris</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleTheme}
                className="flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
                title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 dark:border-zinc-800 border-t-slate-900 dark:border-t-zinc-100"></div>
            </div>
          </div>
        </div>
      </nav>
    )
  }

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Package className="h-7 w-7 text-slate-900 dark:text-zinc-100" />
            <span className="ml-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">Sistem Inventaris</span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1 mx-8">
            <div className="flex items-baseline space-x-1">
              {filteredNavItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Notification Bell - Desktop Only */}
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="flex items-center px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
                title="Notifikasi Stok"
              >
                <Bell className="h-4 w-4" />
                {outOfStockCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {outOfStockCount}
                  </span>
                )}
              </button>
              
              {/* Notification Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-slate-200 dark:border-zinc-800 z-50">
                  <div className="p-4 border-b border-slate-200 dark:border-zinc-800">
                    <h3 className="font-semibold text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                      Notifikasi Stok
                    </h3>
                  </div>
                  <div className="max-h-96 overflow-y-auto">
                    {lowStockProducts.length === 0 ? (
                      <div className="p-4 text-center text-slate-600 dark:text-zinc-400">
                        Tidak ada notifikasi
                      </div>
                    ) : (
                      lowStockProducts.map((product) => (
                        <Link
                          key={product.id}
                          href="/products"
                          onClick={() => setShowNotifications(false)}
                          className="block px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors border-b border-slate-100 dark:border-zinc-800 last:border-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="font-medium text-slate-900 dark:text-zinc-100">
                                {product.name}
                              </div>
                              <div className="text-sm text-slate-600 dark:text-zinc-400">
                                {product.sku} - {product.color} - {product.size}
                              </div>
                            </div>
                            <div className={`ml-3 px-2 py-1 rounded-lg text-xs font-bold ${
                              product.stock === 0
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                            }`}>
                              {product.stock === 0 ? 'HABIS' : product.stock}
                            </div>
                          </div>
                        </Link>
                      ))
                    )}
                  </div>
                  {lowStockProducts.length > 0 && (
                    <div className="p-3 border-t border-slate-200 dark:border-zinc-800">
                      <Link
                        href="/products"
                        onClick={() => setShowNotifications(false)}
                        className="block text-center text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-zinc-100"
                      >
                        Lihat Semua Produk
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Theme Toggle - Desktop Only */}
            <button
              onClick={toggleTheme}
              className="hidden sm:flex items-center px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
              title={theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            
            {/* Logout - Desktop Only */}
            <button
              onClick={handleLogout}
              className="hidden sm:flex items-center px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden lg:inline">Keluar</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={handleMobileMenuToggle}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100"
              aria-expanded={isMobileMenuOpen}
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu - Collapsible */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 animate-in slide-in-from-top-2 duration-200">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {/* Mobile Notifications */}
            <div className="px-4 py-2 border-b border-slate-200 dark:border-zinc-800">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-900 dark:text-zinc-100">
                  Notifikasi Stok
                </span>
                {outOfStockCount > 0 && (
                  <span className="h-6 w-6 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                    {outOfStockCount}
                  </span>
                )}
              </div>
              {lowStockProducts.length > 0 && (
                <div className="mt-2 space-y-2">
                  {lowStockProducts.slice(0, 3).map((product) => (
                    <Link
                      key={product.id}
                      href="/products"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block p-2 bg-slate-50 dark:bg-zinc-800 rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-zinc-100 truncate">
                            {product.name}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-zinc-400">
                            {product.sku}
                          </div>
                        </div>
                        <div className={`ml-2 px-2 py-1 rounded-lg text-xs font-bold ${
                          product.stock === 0
                            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                            : 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                        }`}>
                          {product.stock === 0 ? 'HABIS' : product.stock}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Items */}
            {filteredNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                      : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100"
                  }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.label}
                </Link>
              )
            })}
            
            {/* Theme Toggle */}
            <button
              onClick={() => {
                toggleTheme()
              }}
              className="flex items-center w-full px-4 py-3 rounded-xl text-base font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
            >
              {theme === 'dark' ? <Sun className="h-5 w-5 mr-3" /> : <Moon className="h-5 w-5 mr-3" />}
              {theme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}
            </button>
            
            {/* Logout */}
            <button
              onClick={() => {
                handleLogout()
                setIsMobileMenuOpen(false)
              }}
              className="flex items-center w-full px-4 py-3 rounded-xl text-base font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
            >
              <LogOut className="h-5 w-5 mr-3" />
              Keluar
            </button>
          </div>
        </div>
      )}
    </nav>
  )
}