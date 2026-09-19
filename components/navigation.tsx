'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Package, Scan, ShoppingCart, BarChart3, Menu, X, Clock, LogOut, Layers, Warehouse, ChevronDown, ChevronRight, Scissors, GitBranch, PieChart, TrendingUp } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, loading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [vendorMenuOpen, setVendorMenuOpen] = useState(false)
  
  const navItems = [
    { href: "/", label: "Dasbor Stok", icon: BarChart3 },
    { href: "/qc-inbound", label: "Barang Masuk", icon: ShoppingCart },
    { href: "/packing-outbound", label: "Barang Keluar", icon: Scan },
    { href: "/raw-fabric", label: "Kain Utuh", icon: Layers },
    { href: "/warehouse-2", label: "Gudang 2", icon: Warehouse },
    { 
      label: "Monitoring Vendor", 
      icon: Scissors,
      submenu: [
        { href: "/production/bapak-iwan", label: "Bapak Iwan" },
        { href: "/production/bapak-cecep", label: "Bapak Cecep" },
        { href: "/production/bapak-didin", label: "Bapak Didin" },
      ]
    },
    { href: "/traceability", label: "Traceability", icon: GitBranch },
    { href: "/history", label: "Riwayat", icon: Clock },
    { href: "/analytics", label: "Analitik", icon: PieChart },
    { href: "/products", label: "Produk", icon: Package },
  ]

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  // Don't show navigation on login page
  if (pathname === '/login') {
    return null
  }

  // For now, show navigation even without auth (simple admin/admin login)
  // When full Supabase auth is needed, uncomment the lines below:
  // if (!loading && !user) {
  //   return null
  // }

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
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-slate-200 dark:border-zinc-800 border-t-slate-900 dark:border-t-zinc-100"></div>
          </div>
        </div>
      </nav>
    )
  }

  const isVendorSubmenuActive = navItems.some(item => 
    item.submenu && item.submenu.some(subItem => pathname === subItem.href)
  )

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
            >
              {isSidebarOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <Package className="h-7 w-7 text-slate-900 dark:text-zinc-100" />
            <span className="ml-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">Sistem Inventaris</span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center justify-between flex-1">
            <div className="ml-10 flex items-baseline space-x-1">
              {navItems.map((item) => {
                if (item.submenu) {
                  const Icon = item.icon
                  const isActive = isVendorSubmenuActive
                  return (
                    <div key={item.label} className="relative">
                      <button
                        onClick={() => setVendorMenuOpen(!vendorMenuOpen)}
                        className={`flex items-center px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          isActive
                            ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                            : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100"
                        }`}
                      >
                        <Icon className="h-4 w-4 mr-2" />
                        {item.label}
                        {vendorMenuOpen ? (
                          <ChevronDown className="h-4 w-4 ml-1" />
                        ) : (
                          <ChevronRight className="h-4 w-4 ml-1" />
                        )}
                      </button>
                      {vendorMenuOpen && (
                        <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-slate-200 dark:border-zinc-800 py-2">
                          {item.submenu.map((subItem) => (
                            <Link
                              key={subItem.href}
                              href={subItem.href}
                              onClick={() => setVendorMenuOpen(false)}
                              className={`block px-4 py-2 text-sm transition-colors ${
                                pathname === subItem.href
                                  ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                                  : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100"
                              }`}
                            >
                              {subItem.label}
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                }
                
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
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Keluar
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100"
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
        <div className="md:hidden border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {navItems.map((item) => {
              if (item.submenu) {
                const Icon = item.icon
                const isActive = isVendorSubmenuActive
                return (
                  <div key={item.label}>
                    <button
                      onClick={() => setVendorMenuOpen(!vendorMenuOpen)}
                      className={`flex items-center w-full px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                        isActive
                          ? "bg-slate-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                          : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100"
                      }`}
                    >
                      <Icon className="h-5 w-5 mr-3" />
                      {item.label}
                      {vendorMenuOpen ? (
                        <ChevronDown className="h-5 w-5 ml-auto" />
                      ) : (
                        <ChevronRight className="h-5 w-5 ml-auto" />
                      )}
                    </button>
                    {vendorMenuOpen && (
                      <div className="pl-8 space-y-1">
                        {item.submenu.map((subItem) => (
                          <Link
                            key={subItem.href}
                            href={subItem.href}
                            onClick={() => {
                              setIsMobileMenuOpen(false)
                              setVendorMenuOpen(false)
                            }}
                            className={`block px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${
                              pathname === subItem.href
                                ? "bg-slate-100 dark:bg-zinc-800 text-slate-900 dark:text-zinc-100"
                                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100"
                            }`}
                          >
                            {subItem.label}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }
              
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