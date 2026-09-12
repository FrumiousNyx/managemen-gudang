import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  const isLoginPage = path === '/login'
  
  // Get session cookie
  const accessToken = request.cookies.get('sb-access-token')

  const hasSession = accessToken?.value === 'admin'

  // If trying to access login page while already authenticated, redirect to home
  if (isLoginPage && hasSession) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Require authentication for all pages except login
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
