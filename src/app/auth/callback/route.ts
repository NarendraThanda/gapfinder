import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    try {
      const supabase = await createServerSupabaseClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        // Successful verification -> redirect to destination
        return NextResponse.redirect(`${origin}${next}`)
      }

      console.error('Auth code exchange error:', error.message)
    } catch (err: any) {
      console.error('Auth callback exception:', err?.message || err)
    }
  }

  // If code was invalid or missing, redirect to login with notification
  return NextResponse.redirect(`${origin}/auth/login?verified=true`)
}
