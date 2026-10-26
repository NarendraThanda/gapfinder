import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // Determine the canonical public origin
  // On Vercel, x-forwarded-host preserves the exact public domain the user visited (e.g. gapfinder-kappa.vercel.app)
  // whereas requestUrl.origin can point to an internal ephemeral deployment URL that causes 404 DEPLOYMENT_NOT_FOUND.
  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'

  let baseUrl: string
  if (forwardedHost) {
    baseUrl = `${forwardedProto}://${forwardedHost}`
  } else if (process.env.NEXT_PUBLIC_SITE_URL) {
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '')
  } else {
    baseUrl = 'https://gapfinder-kappa.vercel.app'
  }

  // Ensure target path is valid
  const targetPath = next.startsWith('/') ? next : `/${next}`

  if (code) {
    try {
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        return NextResponse.redirect(`${baseUrl}${targetPath}`)
      }

      console.error('Auth code exchange error:', error.message)
    } catch (err: any) {
      console.error('Auth callback exception:', err?.message || err)
    }
  }

  // If code was invalid or exchange failed, safely return to login page
  return NextResponse.redirect(`${baseUrl}/auth/login?error=confirmation_failed`)
}
