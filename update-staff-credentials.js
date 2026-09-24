const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function updateStaffCredentials() {
  try {
    console.log('Starting staff credentials update...')

    // Get the first staff user
    const { data: staffUsers, error: staffError } = await supabase
      .from('users')
      .select('*')
      .eq('role', 'staff')
      .limit(1)

    if (staffError) throw staffError

    if (staffUsers.length === 0) {
      console.log('No staff users found. Creating new admin staff account...')
      
      // Create new admin staff account
      const { error: createError } = await supabase
        .from('users')
        .insert({
          email: 'admin',
          full_name: 'Admin Staff',
          password_hash: 'admin',
          role: 'staff'
        })

      if (createError) throw createError
      console.log('Created new admin staff account with username/password: admin/admin')
    } else {
      console.log(`Found ${staffUsers.length} staff user(s)`)

      // Update the first staff user to admin/admin
      const staffUser = staffUsers[0]
      const { error } = await supabase
        .from('users')
        .update({ 
          email: 'admin',
          full_name: 'Admin Staff',
          password_hash: 'admin' // Note: In production, this should be properly hashed
        })
        .eq('id', staffUser.id)

      if (error) {
        console.error(`Failed to update staff user ${staffUser.id}:`, error)
      } else {
        console.log(`Updated staff user ${staffUser.email} to admin/admin`)
      }
    }

    console.log('Staff credentials update completed successfully!')
  } catch (error) {
    console.error('Error updating staff credentials:', error)
    process.exit(1)
  }
}

updateStaffCredentials()