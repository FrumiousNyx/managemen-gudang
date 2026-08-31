import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Product = {
  id: string
  sku: string
  name: string
  color: string
  size: string
  stock: number
  created_at: string
}

export type InventoryLog = {
  id: string
  product_id: string
  type: 'INBOUND_QC' | 'OUTBOUND_PACKING'
  qty: number
  notes: string | null
  created_at: string
  product?: Product
}