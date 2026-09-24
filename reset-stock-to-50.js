const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function resetStockTo50() {
  try {
    console.log('Fetching all products...')
    const { data: products, error: fetchError } = await supabase
      .from('products')
      .select('id, sku, name, stock')

    if (fetchError) {
      console.error('Error fetching products:', fetchError)
      process.exit(1)
    }

    console.log(`Found ${products.length} products`)

    // Filter out products with SKU starting with "ASM" (Asimetri) or "LNA" (Lina)
    const productsToUpdate = products.filter(
      product => 
        !product.sku.toUpperCase().startsWith('ASM') && 
        !product.sku.toUpperCase().startsWith('LNA')
    )

    console.log(`Products to update (excluding ASM and LNA): ${productsToUpdate.length}`)
    console.log(`Products to skip (ASM and LNA): ${products.length - productsToUpdate.length}`)

    // Filter only products that don't already have stock = 50
    const productsNeedingUpdate = productsToUpdate.filter(p => p.stock !== 50)
    console.log(`Products that actually need update (stock ≠ 50): ${productsNeedingUpdate.length}`)

    if (productsNeedingUpdate.length === 0) {
      console.log('All non-ASM/LNA products already have stock = 50. No updates needed.')
      return
    }

    // Batch update stock to 50 for filtered products
    const productIds = productsNeedingUpdate.map(p => p.id)
    const { error: updateError } = await supabase
      .from('products')
      .update({ stock: 50 })
      .in('id', productIds)

    if (updateError) {
      console.error('Error batch updating products:', updateError)
      process.exit(1)
    }

    console.log(`\n✅ Successfully updated ${productsNeedingUpdate.length} products to stock 50`)
    console.log(`📝 No inventory_logs entries were created (direct stock update only)`)
    
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

resetStockTo50()
