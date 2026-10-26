import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const next = requestUrl.searchParams.get('next') ?? '/dashboard'

  // Determine the canonical public origin
  // In production, ALWAYS redirect to the canonical production URL (or localhost in dev)
  // to avoid ephemeral Vercel deployment hashes that produce 404 DEPLOYMENT_NOT_FOUND
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  let baseUrl: string
  if (host.includes('localhost') || host.includes('127.0.0.1')) {
    baseUrl = `http://${host}`
  } else {
    baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') || 'https://gapfinder-kappa.vercel.app'
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
