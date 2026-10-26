'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LuSparkles, LuMail, LuLock, LuEye, LuEyeOff, LuLoader, LuCircleCheck, LuTriangleAlert } from 'react-icons/lu'
import { FcGoogle } from 'react-icons/fc'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isVerified = searchParams.get('verified') === 'true'
  const isConfirmationFailed = searchParams.get('error') === 'confirmation_failed'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(
    isConfirmationFailed
      ? 'Email confirmation link was invalid or expired. Please sign in with your credentials.'
      : ''
  )
  const [infoMessage] = useState(
    isVerified ? 'Your email was successfully verified! You can now sign in.' : ''
  )
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  const formatAuthError = (err: any): string => {
    if (!err) return 'An error occurred during sign in. Please try again.'
    const msg = (err.message || String(err)).toLowerCase()
    const code = err.code || ''

    if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
      return 'Incorrect email or password. Please check your credentials and try again.'
    }
    if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) {
      return 'Please verify your email address before signing in. Check your inbox (or spam) for the confirmation link.'
    }
    if (code === 'over_email_send_rate_limit' || msg.includes('rate limit')) {
      return 'Rate limit reached. Please wait a few moments before trying again.'
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network connection issue. Please check your internet connection.'
    }
    return err.message || 'Authentication failed. Please verify your credentials and try again.'
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Please enter your email address.')
      return
    }
    if (!trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Please enter a valid email address.')
      return
    }
    if (!password) {
      setError('Please enter your password.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      })

      if (authError) {
        setError(formatAuthError(authError))
        return
      }

      if (data?.session) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Session could not be established. Please try signing in again.')
      }
    } catch (err: any) {
      console.error('Sign in exception:', err)
      setError(formatAuthError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setError('')
    setGoogleLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      })

      if (authError) {
        setError(formatAuthError(authError))
        setGoogleLoading(false)
      }
    } catch (err: any) {
      console.error('Google sign in exception:', err)
      setError(formatAuthError(err))
      setGoogleLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setError('')
    setEmail('demo@gapfinder.ai')
    setPassword('demo123456')
    setDemoLoading(true)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: 'demo@gapfinder.ai',
        password: 'demo123456',
      })

      if (authError) {
        setError(formatAuthError(authError))
        return
      }

      if (data?.session) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Demo session could not be initialized.')
      }
    } catch (err: any) {
      console.error('Demo sign in exception:', err)
      setError(formatAuthError(err))
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="glass p-8 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
      {infoMessage && (
        <div
          className="mb-5 p-3 rounded-lg text-sm flex items-center gap-2"
          style={{
            background: 'rgba(74, 222, 128, 0.1)',
            color: 'var(--accent-success)',
            border: '1px solid rgba(74, 222, 128, 0.3)',
          }}
        >
          <LuCircleCheck size={16} className="shrink-0" />
          <span>{infoMessage}</span>
        </div>
      )}

      {/* Google OAuth Button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        className="btn-secondary w-full flex items-center justify-center gap-3 py-3 font-medium transition-all duration-200 mb-6"
        style={{
          background: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid var(--border-glass)',
        }}
        disabled={loading || demoLoading || googleLoading}
        id="google-login-btn"
      >
        {googleLoading ? (
          <LuLoader className="animate-spin" size={18} />
        ) : (
          <FcGoogle size={20} />
        )}
        <span>{googleLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
      </button>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>OR SIGN IN WITH EMAIL</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Email
          </label>
          <div className="relative flex items-center">
            <LuMail className="absolute left-4 pointer-events-none z-10" style={{ color: 'var(--text-muted)' }} size={18} />
            <input
              type="email"
              className="input-glass pl-12"
              style={{ paddingLeft: '3rem' }}
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (error) setError('')
              }}
              required
              id="login-email"
              autoComplete="email"
              disabled={loading || demoLoading || googleLoading}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
            Password
          </label>
          <div className="relative flex items-center">
            <LuLock className="absolute left-4 pointer-events-none z-10" style={{ color: 'var(--text-muted)' }} size={18} />
            <input
              type={showPassword ? 'text' : 'password'}
              className="input-glass pl-12 pr-12"
              style={{ paddingLeft: '3rem', paddingRight: '3rem' }}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                if (error) setError('')
              }}
              required
              id="login-password"
              autoComplete="current-password"
              disabled={loading || demoLoading || googleLoading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 z-10 p-1"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Toggle password visibility"
              tabIndex={-1}
            >
              {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
            </button>
          </div>
        </div>

        {error && (
          <div
            className="p-3 rounded-lg text-sm flex items-start gap-2"
            style={{
              background: 'rgba(248, 113, 113, 0.1)',
              color: 'var(--accent-danger)',
              border: '1px solid rgba(248, 113, 113, 0.3)',
            }}
          >
            <LuTriangleAlert size={16} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          className="btn-primary w-full flex items-center justify-center gap-2"
          disabled={loading || demoLoading || googleLoading}
          id="login-submit"
        >
          {loading ? <LuLoader className="animate-spin" size={18} /> : null}
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <div className="my-6 flex items-center gap-4">
        <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
        <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>OR EVALUATE DEMO</span>
        <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
      </div>

      <button
        type="button"
        onClick={handleDemoLogin}
        className="btn-secondary w-full flex items-center justify-center gap-2"
        disabled={loading || demoLoading || googleLoading}
        id="demo-login-btn"
      >
        {demoLoading ? <LuLoader className="animate-spin" size={16} /> : <LuSparkles size={16} />}
        {demoLoading ? 'Loading Demo Workspace...' : 'Try Demo Account (Judge Mode)'}
      </button>

      <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Don&apos;t have an account?{' '}
        <Link href="/auth/signup" className="font-medium" style={{ color: 'var(--accent-primary)' }}>
          Sign Up
        </Link>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fadeIn">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <LuSparkles size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">GapFinder AI</span>
          </Link>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back! Sign in to continue.</p>
        </div>

        <Suspense fallback={<div className="glass p-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</div>}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
