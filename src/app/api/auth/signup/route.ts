import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password, fullName } = await request.json()

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required.' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName || email.split('@')[0],
        },
      },
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Ensure profile row exists if session is established
    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: data.user.email,
          full_name: fullName || data.user.email?.split('@')[0],
        })
      } catch (profileErr) {
        console.warn('Profile creation non-critical notice:', profileErr)
      }
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      requiresEmailConfirmation: !data.session,
    })
  } catch (err: any) {
    console.error('Signup API route error:', err)
    return NextResponse.json(
      { error: err?.message || 'Server signup failed. Check Supabase credentials.' },
      { status: 500 }
    )
  }
}
