'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Package, Scan, ShoppingCart, BarChart3, Menu, X, Clock, TrendingUp, LogOut, Users, Building2, Scissors, LayoutGrid } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut, loading } = useAuth()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  
  const navItems = [
    { href: "/", label: "Dasbor Stok", icon: BarChart3 },
    { href: "/qc-inbound", label: "Barang Masuk", icon: ShoppingCart },
    { href: "/packing-outbound", label: "Barang Keluar", icon: Scan },
    { href: "/history", label: "Riwayat", icon: Clock },
    { href: "/analytics", label: "Analitik", icon: TrendingUp },
    { href: "/products", label: "Produk", icon: Package },
    { href: "/suppliers", label: "Supplier Kain", icon: Building2 },
    { href: "/vendors", label: "Vendor Jahit", icon: Users },
    { href: "/raw-materials", label: "Kain Belum Jadi", icon: Scissors },
    { href: "/production", label: "Produksi", icon: LayoutGrid },
  ]

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
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

  return (
    <>
      <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={toggleSidebar}
                className="inline-flex items-center justify-center p-2 rounded-xl text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-zinc-100 mr-3"
              >
                {isSidebarOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
              <Package className="h-7 w-7 text-slate-900 dark:text-zinc-100" />
              <span className="ml-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">Sistem Inventaris</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="flex items-center px-4 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 transition-all duration-200"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Keluar
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar - Desktop & Mobile */}
      {isSidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="fixed top-16 left-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-slate-200 dark:border-zinc-800 z-50 transform transition-transform duration-300 ease-in-out">
            <div className="p-4">
              <p className="text-xs font-semibold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-4">
                Menu Utama
              </p>
              <div className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon
                  const isActive = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setIsSidebarOpen(false)}
                      className={`flex items-center px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
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
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}