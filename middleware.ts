import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isLoginPage = path === '/login'
  
  // Check for custom user session cookie
  const userSession = request.cookies.get('user_session')
  const hasSession = userSession?.value === 'true'

  // If trying to access login page while already authenticated, redirect to home
  if (isLoginPage && hasSession) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // If trying to access protected pages without authentication, redirect to login
  if (!isLoginPage && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
}
