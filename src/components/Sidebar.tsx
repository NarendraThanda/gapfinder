'use client'

import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LuLayoutDashboard,
  LuUpload,
  LuMap,
  LuBrain,
  LuChartBar,
  LuCalendarCheck,
  LuMessageCircle,
  LuTrendingUp,
  LuLogOut,
  LuMenu,
  LuX,
  LuSparkles,
} from 'react-icons/lu'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LuLayoutDashboard },
  { href: '/materials', label: 'Materials', icon: LuUpload },
  { href: '/topics', label: 'Topic Map', icon: LuMap },
  { href: '/quiz', label: 'Diagnostic Quiz', icon: LuBrain },
  { href: '/gap-report', label: 'Gap Report', icon: LuChartBar },
  { href: '/revision-plan', label: 'Revision Plan', icon: LuCalendarCheck },
  { href: '/assistant', label: 'AI Assistant', icon: LuMessageCircle },
  { href: '/progress', label: 'Progress', icon: LuTrendingUp },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || 'Student')
      }
    })
  }, [])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <>
      {/* Mobile Top Navigation Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 bg-[#0a0b14]/90 backdrop-blur-md border-b border-[var(--border-glass)] z-40 px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="btn-icon w-9 h-9"
            id="sidebar-toggle"
            aria-label="Toggle navigation menu"
          >
            {isOpen ? <LuX size={18} /> : <LuMenu size={18} />}
          </button>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <LuSparkles size={14} className="text-white" />
            </div>
            <span className="font-bold text-sm gradient-text">GapFinder AI</span>
          </div>
        </div>

        {userName && (
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold"
            style={{ background: 'var(--gradient-secondary)', color: 'white' }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`w-[260px] shrink-0 bg-[#0b0c1a]/95 backdrop-blur-xl border-r border-[var(--border-glass)] z-50 transition-transform duration-300 fixed inset-y-0 left-0 md:sticky md:top-0 md:h-screen md:translate-x-0 overflow-y-auto ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: '260px' }}
      >
        <div className="flex flex-col h-full p-4">
          {/* Logo & Mobile Close */}
          <div className="flex items-center justify-between mb-8 px-2 pt-2">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: 'var(--gradient-primary)' }}
              >
                <LuSparkles size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold gradient-text">GapFinder</h1>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>AI Study Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="md:hidden p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5"
              aria-label="Close sidebar"
            >
              <LuX size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* User section */}
          <div className="border-t pt-4 mt-4" style={{ borderColor: 'var(--border-glass)' }}>
            <div className="flex items-center gap-3 px-2 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold"
                style={{ background: 'var(--gradient-secondary)', color: 'white' }}>
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="sidebar-link w-full text-left"
              style={{ color: 'var(--accent-danger)' }}
              id="logout-button"
            >
              <LuLogOut size={18} />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
