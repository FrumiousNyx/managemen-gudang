const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function setupUsers() {
  try {
    console.log('Starting user setup for staff and viewer accounts...')

    // Setup Staff User
    console.log('\n--- Setting up Staff User ---')
    const { data: existingStaff, error: staffCheckError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'staff@gudang.com')
      .single()

    if (staffCheckError && staffCheckError.code !== 'PGRST116') {
      throw staffCheckError
    }

    if (!existingStaff) {
      console.log('Creating staff user...')
      const { error: createStaffError } = await supabase
        .from('users')
        .insert({
          email: 'staff@gudang.com',
          full_name: 'Staff Gudang',
          password_hash: 'staff123',
          role: 'staff'
        })

      if (createStaffError) throw createStaffError
      console.log('✓ Created staff user: staff@gudang.com / staff123')
    } else {
      console.log('✓ Staff user already exists: staff@gudang.com')
    }

    // Setup Viewer User
    console.log('\n--- Setting up Viewer User ---')
    const { data: existingViewer, error: viewerCheckError } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'viewer@gudang.com')
      .single()

    if (viewerCheckError && viewerCheckError.code !== 'PGRST116') {
      throw viewerCheckError
    }

    if (!existingViewer) {
      console.log('Creating viewer user...')
      const { error: createViewerError } = await supabase
        .from('users')
        .insert({
          email: 'viewer@gudang.com',
          full_name: 'Viewer Gudang',
          password_hash: 'viewer123',
          role: 'viewer'
        })

      if (createViewerError) throw createViewerError
      console.log('✓ Created viewer user: viewer@gudang.com / viewer123')
    } else {
      console.log('✓ Viewer user already exists: viewer@gudang.com')
    }

    // Display all users
    console.log('\n--- Current Users ---')
    const { data: allUsers, error: usersError } = await supabase
      .from('users')
      .select('email, full_name, role, is_active')
      .order('role')

    if (usersError) throw usersError

    allUsers.forEach(user => {
      const status = user.is_active ? '✓ Active' : '✗ Inactive'
      console.log(`${status} | ${user.role.padEnd(8)} | ${user.email.padEnd(25)} | ${user.full_name}`)
    })

    console.log('\n✓ User setup completed successfully!')
    console.log('\nCredentials:')
    console.log('  Admin: admin@gudang.com / admin123')
    console.log('  Staff: staff@gudang.com / staff123')
    console.log('  Viewer: viewer@gudang.com / viewer123')
  } catch (error) {
    console.error('Error during user setup:', error)
    process.exit(1)
  }
}

setupUsers()