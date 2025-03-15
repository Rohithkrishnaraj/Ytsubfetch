import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  try {
    // Create a response to modify
    const res = NextResponse.next()
    
    // Create supabase client configured to use cookies
    const supabase = createMiddlewareClient({ req, res })
    
    // Refresh session if expired
    const { data: { session }, error } = await supabase.auth.getSession()
    
    // Debug logging
    console.log('Middleware - Session:', session ? 'exists' : 'none')
    console.log('Middleware - Path:', req.nextUrl.pathname)
    
    // Handle auth callback route separately
    if (req.nextUrl.pathname === '/auth/callback') {
      return res
    }

    // Public routes that don't require authentication
    const publicRoutes = ['/login']
    const isPublicRoute = publicRoutes.includes(req.nextUrl.pathname)

    // If there's an error getting the session, redirect to login
    if (error) {
      console.error('Middleware auth error:', error)
      if (!isPublicRoute) {
        return NextResponse.redirect(new URL('/login', req.url))
      }
      return res
    }

    // If user is not signed in and trying to access protected route
    if (!session && !isPublicRoute) {
      console.log('Middleware - No session, redirecting to login')
      return NextResponse.redirect(new URL('/login', req.url))
    }

    // If user is signed in and trying to access login page
    if (session && isPublicRoute) {
      console.log('Middleware - Session exists, redirecting to dashboard')
      return NextResponse.redirect(new URL('/dashboard', req.url))
    }

    // Set security headers for all responses
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.headers.set('Pragma', 'no-cache')
    res.headers.set('Expires', '0')
    
    return res
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.redirect(new URL('/login', req.url))
  }
}

// Specify which routes should be handled by the middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
} 