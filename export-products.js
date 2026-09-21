const { createClient } = require('@supabase/supabase-js')
const XLSX = require('xlsx')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function exportProducts() {
  console.log('Fetching products from Supabase...')
  
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .order('sku', { ascending: true })

  if (error) {
    console.error('Error fetching products:', error)
    process.exit(1)
  }

  console.log(`Found ${products.length} products`)

  // Transform data for Excel
  const excelData = products.map(p => ({
    SKU: p.sku,
    Name: p.name,
    Color: p.color,
    Size: p.size,
    Stock: p.stock,
    'Stock Threshold': p.stock_threshold || '',
    'Created At': p.created_at || ''
  }))

  // Create workbook
  const ws = XLSX.utils.json_to_sheet(excelData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Products')

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `products-export-${timestamp}.xlsx`

  // Write file
  XLSX.writeFile(wb, filename)
  console.log(`✓ Exported ${products.length} products to ${filename}`)
}

exportProducts()
