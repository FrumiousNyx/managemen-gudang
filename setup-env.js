const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '.env.local');

if (fs.existsSync(envLocalPath)) {
  console.log('.env.local file already exists. Skipping creation.');
  process.exit(0);
}

const envContent = `# Supabase Configuration
# Get these values from your Supabase project settings
# https://supabase.com/dashboard/project/_/settings/api
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
`;

fs.writeFileSync(envLocalPath, envContent);
console.log('.env.local file created successfully!');
console.log('Please update the placeholder values with your actual Supabase credentials.');