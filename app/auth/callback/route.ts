import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')

    console.log('Auth Callback - Received code:', code ? 'yes' : 'no')

    if (code) {
      const cookieStore = cookies()
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
      
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      console.log('Auth Callback - Exchange result:', error ? 'error' : 'success')
      
      if (error) {
        console.error('Auth error:', error)
        return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL))
      }

      // Verify session was created
      const { data: { session } } = await supabase.auth.getSession()
      console.log('Auth Callback - Session created:', session ? 'yes' : 'no')

      if (!session) {
        console.error('Auth Callback - No session after exchange')
        return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL))
      }
    }

    // Use the environment variable for redirection
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    const response = NextResponse.redirect(new URL('/dashboard', baseUrl))
    
    // Set security headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    
    return response
  } catch (error) {
    console.error('Callback error:', error)
    return NextResponse.redirect(new URL('/login', process.env.NEXT_PUBLIC_BASE_URL))
  }
}
