'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { LuSparkles, LuMail, LuLock, LuEye, LuEyeOff, LuLoader } from 'react-icons/lu'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleDemoLogin = async () => {
    setEmail('demo@gapfinder.ai')
    setPassword('demo123456')
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: 'demo@gapfinder.ai',
        password: 'demo123456',
      })

      if (authError) {
        setError('Demo account not set up yet. Please create an account.')
        return
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Demo login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fadeIn">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)' }}>
              <LuSparkles size={24} className="text-white" />
            </div>
            <span className="text-2xl font-bold gradient-text">GapFinder AI</span>
          </Link>
          <p style={{ color: 'var(--text-secondary)' }}>Welcome back! Sign in to continue.</p>
        </div>

        {/* Login Form */}
        <div className="glass p-8 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Email
              </label>
              <div className="relative">
                <LuMail className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} size={18} />
                <input
                  type="email"
                  className="input-glass pl-12"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  id="login-email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                Password
              </label>
              <div className="relative">
                <LuLock className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="input-glass pl-12 pr-12"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  id="login-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {showPassword ? <LuEyeOff size={18} /> : <LuEye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(248, 113, 113, 0.1)', color: 'var(--accent-danger)', border: '1px solid rgba(248, 113, 113, 0.3)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2"
              disabled={loading}
              id="login-submit"
            >
              {loading ? <LuLoader className="animate-spin" size={18} /> : null}
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="my-6 flex items-center gap-4">
            <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>OR</span>
            <div className="flex-1 h-px" style={{ background: 'var(--border-glass)' }} />
          </div>

          <button
            onClick={handleDemoLogin}
            className="btn-secondary w-full flex items-center justify-center gap-2"
            disabled={loading}
            id="demo-login-btn"
          >
            <LuSparkles size={16} />
            Try Demo Account
          </button>

          <p className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-medium" style={{ color: 'var(--accent-primary)' }}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
