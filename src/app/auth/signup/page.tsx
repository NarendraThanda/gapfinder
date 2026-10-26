'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LuSparkles, LuMail, LuLock, LuEye, LuEyeOff, LuUser, LuLoader, LuCircleCheck, LuTriangleAlert, LuArrowRight } from 'react-icons/lu'

export default function SignUpPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const formatSignUpError = (err: any): string => {
    if (!err) return 'An error occurred during account creation. Please try again.'
    const msg = (err.message || String(err)).toLowerCase()
    const code = err.code || ''

    if (code === 'user_already_exists' || msg.includes('user already registered') || msg.includes('already exists')) {
      return 'An account with this email already exists. Please sign in instead.'
    }
    if (code === 'email_address_invalid' || msg.includes('email address') || msg.includes('invalid')) {
      return 'Please enter a valid email address (temporary and disposable domains are restricted).'
    }
    if (code === 'weak_password' || msg.includes('password') && msg.includes('short')) {
      return 'Password should be at least 6 characters long.'
    }
    if (code === 'over_email_send_rate_limit' || msg.includes('rate limit') || msg.includes('429')) {
      return 'Sign up rate limit reached. Please wait a few minutes before trying again.'
    }
    if (msg.includes('network') || msg.includes('fetch')) {
      return 'Network connection error. Please check your internet connection.'
    }
    return err.message || 'Failed to create account. Please verify your details and try again.'
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const trimmedName = fullName.trim()
    const trimmedEmail = email.trim()

    if (!trimmedName) {
      setError('Please enter your full name.')
      return
    }
    if (!trimmedEmail || !trimmedEmail.includes('@') || !trimmedEmail.includes('.')) {
      setError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      })

      if (authError) {
        setError(formatSignUpError(authError))
        return
      }

      if (data?.session) {
        // Auto-confirmed or confirmations disabled -> immediate session
        router.push('/dashboard')
        router.refresh()
      } else {
        // Email confirmation is required by Supabase
        setSuccess(
          `Account created successfully! A confirmation link has been sent to ${trimmedEmail}. Please check your inbox (and spam folder) to verify your account, then sign in.`
        )
      }
    } catch (err: any) {
      console.error('Sign up exception:', err)
      setError(formatSignUpError(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setError('')
    setDemoLoading(true)
    try {
      const supabase = createClient()
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: 'demo@gapfinder.ai',
        password: 'demo123456',
      })

      if (authError) {
        setError(formatSignUpError(authError))
        return
      }

      if (data?.session) {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError('Demo account session could not be established.')
      }
    } catch (err: any) {
      console.error('Demo login exception:', err)
      setError(formatSignUpError(err))
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
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
          <p style={{ color: 'var(--text-secondary)' }}>Create your account to start diagnosing knowledge gaps</p>
        </div>

        {/* Signup Form */}
        <div className="glass p-8 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          {success ? (
            <div className="space-y-5 animate-fadeIn">
              <div
                className="p-4 rounded-xl text-sm"
                style={{
                  background: 'rgba(74, 222, 128, 0.1)',
                  color: 'var(--accent-success)',
                  border: '1px solid rgba(74, 222, 128, 0.3)',
                }}
              >
                <div className="flex items-start gap-3">
                  <LuCircleCheck size={20} className="shrink-0 mt-0.5 text-emerald-400" />
                  <div>
                    <h4 className="font-semibold text-white mb-1">Verify Your Email</h4>
                    <p className="text-xs leading-relaxed text-zinc-300">{success}</p>
                  </div>
                </div>
              </div>

              <Link
                href="/auth/login"
                className="btn-primary w-full flex items-center justify-center gap-2"
                id="signup-success-signin-btn"
              >
                <span>Proceed to Sign In</span>
                <LuArrowRight size={16} />
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Full Name
                </label>
                <div className="relative flex items-center">
                  <LuUser className="absolute left-4 pointer-events-none z-10" style={{ color: 'var(--text-muted)' }} size={18} />
                  <input
                    type="text"
                    className="input-glass pl-12"
                    style={{ paddingLeft: '3rem' }}
                    placeholder="Alex Morgan"
                    value={fullName}
                    onChange={(e) => {
                      setFullName(e.target.value)
                      if (error) setError('')
                    }}
                    required
                    id="signup-name"
                    autoComplete="name"
                    disabled={loading || demoLoading}
                  />
                </div>
              </div>

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
                    placeholder="alex@university.edu"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      if (error) setError('')
                    }}
                    required
                    id="signup-email"
                    autoComplete="email"
                    disabled={loading || demoLoading}
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
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (error) setError('')
                    }}
                    required
                    minLength={6}
                    id="signup-password"
                    autoComplete="new-password"
                    disabled={loading || demoLoading}
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
                disabled={loading || demoLoading}
                id="signup-submit"
              >
                {loading ? <LuLoader className="animate-spin" size={18} /> : null}
                {loading ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>OR</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
          </div>

          <button
            type="button"
            onClick={handleDemoLogin}
            className="btn-secondary w-full flex items-center justify-center gap-2"
            disabled={loading || demoLoading}
            id="signup-demo-login-btn"
          >
            {demoLoading ? <LuLoader className="animate-spin" size={16} /> : <LuSparkles size={16} />}
            {demoLoading ? 'Accessing Judge Workspace...' : 'Quick Demo Login (Judge Mode)'}
          </button>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" className="font-medium" style={{ color: 'var(--accent-primary)' }}>
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
