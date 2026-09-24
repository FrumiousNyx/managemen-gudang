const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateThresholds() {
  try {
    console.log('Starting threshold updates...')

    // Update rocela products to threshold 40
    const { data: rocelaProducts, error: rocelaError } = await supabase
      .from('products')
      .select('id, name, sku, stock_threshold')
      .ilike('name', '%rocela%')

    if (rocelaError) throw rocelaError

    console.log(`Found ${rocelaProducts.length} rocela products`)

    for (const product of rocelaProducts) {
      const { error } = await supabase
        .from('products')
        .update({ stock_threshold: 40 })
        .eq('id', product.id)

      if (error) {
        console.error(`Failed to update ${product.name}:`, error)
      } else {
        console.log(`Updated ${product.name} (${product.sku}) threshold to 40`)
      }
    }

    // Update legging rok 3/4 products to threshold 40
    const { data: leggingProducts, error: leggingError } = await supabase
      .from('products')
      .select('id, name, sku, stock_threshold')
      .ilike('name', '%legging rok 3/4%')

    if (leggingError) throw leggingError

    console.log(`Found ${leggingProducts.length} legging rok 3/4 products`)

    for (const product of leggingProducts) {
      const { error } = await supabase
        .from('products')
        .update({ stock_threshold: 40 })
        .eq('id', product.id)

      if (error) {
        console.error(`Failed to update ${product.name}:`, error)
      } else {
        console.log(`Updated ${product.name} (${product.sku}) threshold to 40`)
      }
    }

    // Update lina products to threshold 30
    const { data: linaProducts, error: linaError } = await supabase
      .from('products')
      .select('id, name, sku, stock_threshold')
      .ilike('name', '%lina%')

    if (linaError) throw linaError

    console.log(`Found ${linaProducts.length} lina products`)

    for (const product of linaProducts) {
      const { error } = await supabase
        .from('products')
        .update({ stock_threshold: 30 })
        .eq('id', product.id)

      if (error) {
        console.error(`Failed to update ${product.name}:`, error)
      } else {
        console.log(`Updated ${product.name} (${product.sku}) threshold to 30`)
      }
    }

    console.log('Threshold updates completed successfully!')
  } catch (error) {
    console.error('Error updating thresholds:', error)
    process.exit(1)
  }
}

updateThresholds()