'use client'

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Package, Scan, ShoppingCart, BarChart3, Menu, X } from "lucide-react"

export function Navigation() {
  const pathname = usePathname()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  
  const navItems = [
    { href: "/", label: "Dasbor Stok", icon: BarChart3 },
    { href: "/qc-inbound", label: "Barang Masuk", icon: ShoppingCart },
    { href: "/packing-outbound", label: "Barang Keluar", icon: Scan },
    { href: "/products", label: "Produk", icon: Package },
  ]

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <Package className="h-7 w-7 text-slate-900 dark:text-zinc-100" />
            <span className="ml-2 text-lg font-semibold text-slate-900 dark:text-zinc-100">Sistem Inventaris</span>
          </div>
          
          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-1">
              {navItems.map((item) => {
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
          </div>
        </div>
      )}
    </nav>
  )
}