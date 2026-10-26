import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const DEFAULT_SUPABASE_URL = 'https://ypjbmvyvemelyxfunjij.supabase.co'
const DEFAULT_SUPABASE_KEY = 'sb_publishable_hmShbJqldzsu1p3oSu6rbQ_4US-kiBg'

export async function updateSession(request: NextRequest) {
  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL
    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      DEFAULT_SUPABASE_KEY

    // If configuration is somehow still missing, safely pass through
    if (!supabaseUrl || !supabaseKey) {
      return supabaseResponse
    }

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // If no user and trying to access protected routes, redirect to login
    const protectedPaths = [
      '/dashboard',
      '/materials',
      '/quiz',
      '/gap-report',
      '/revision-plan',
      '/assistant',
      '/progress',
    ]
    const isProtectedRoute = protectedPaths.some((path) =>
      request.nextUrl.pathname.startsWith(path)
    )

    // Helper to get safe canonical base URL for redirects to prevent 404 DEPLOYMENT_NOT_FOUND
    const getCanonicalBase = () => {
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
      if (host.includes('localhost') || host.includes('127.0.0.1')) {
        return `http://${host}`
      }
      return process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://gapfinder-kappa.vercel.app'
    }

    if (!user && isProtectedRoute) {
      return NextResponse.redirect(new URL('/auth/login', getCanonicalBase()))
    }

    // If user is logged in and tries to access auth pages (do NOT intercept /auth/callback!), redirect to dashboard
    if (user && request.nextUrl.pathname.startsWith('/auth/') && !request.nextUrl.pathname.startsWith('/auth/callback')) {
      return NextResponse.redirect(new URL('/dashboard', getCanonicalBase()))
    }

    return supabaseResponse
  } catch (error) {
    console.warn('Middleware updateSession caught error, passing through:', error)
    return NextResponse.next({ request })
  }
}
