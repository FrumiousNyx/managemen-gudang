# Authentication Setup

## Current Status
The login page has been created with a temporary simple authentication system. Currently, you can log in with username "admin" and any password.

## To Enable Full Supabase Authentication

### 1. Set up Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to be ready (usually 1-2 minutes)
3. Go to Project Settings → API
4. Copy your project URL and anon key

### 2. Configure Environment Variables
Create a `.env.local` file in the project root with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### 3. Create Admin User in Supabase
1. Go to your Supabase project dashboard
2. Navigate to Authentication → Users
3. Click "Add User" → "Create New User"
4. Email: `admin` (or use a real email like `admin@yourdomain.com`)
5. Password: Set your desired password
6. Make sure to enable email confirmation if using real email

### 4. Enable Full Authentication
After setting up Supabase, make these changes to enable full authentication:

#### In `app/login/page.tsx`:
Replace the temporary auth with Supabase auth:
```typescript
const { error } = await signIn(email, password)

if (error) {
  setError(error.message || 'Login gagal')
  setLoading(false)
} else {
  router.push('/')
}
```

#### In `middleware.ts`:
Uncomment the authentication check:
```typescript
// If trying to access protected routes without authentication, redirect to login
if (!isLoginPage && !hasSession) {
  return NextResponse.redirect(new URL('/login', request.url))
}
```

#### In `components/navigation.tsx`:
Uncomment the authentication check:
```typescript
// Don't show navigation if not authenticated (and not loading)
if (!loading && !user) {
  return null
}
```

## Features Implemented
- ✅ Login page with Supabase integration
- ✅ Authentication context for session management
- ✅ Logout functionality in navigation
- ✅ Route protection via middleware
- ✅ Responsive design for mobile and desktop
- ✅ Loading states and error handling

## Testing
1. Visit `http://localhost:3000/login`
2. Enter "admin" as username
3. Enter any password (temporary mode)
4. Click "Masuk" to access the dashboard
5. Use the "Keluar" button to logout
