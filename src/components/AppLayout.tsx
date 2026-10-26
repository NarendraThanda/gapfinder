'use client'

import { ReactNode } from 'react'
import Sidebar from './Sidebar'

interface AppLayoutProps {
  children: ReactNode
  headerTitle?: string
  headerSubtitle?: string
  actionButton?: ReactNode
}

export default function AppLayout({
  children,
  headerTitle,
  headerSubtitle,
  actionButton,
}: AppLayoutProps) {
  return (
    <div className="min-h-screen flex">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 md:ml-[260px] min-h-screen flex flex-col p-4 md:p-8 relative z-10">
        {/* Top Header if provided */}
        {(headerTitle || actionButton) && (
          <header className="glass p-6 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fadeIn">
            <div>
              {headerTitle && (
                <h1 className="text-2xl md:text-3xl font-extrabold gradient-text">
                  {headerTitle}
                </h1>
              )}
              {headerSubtitle && (
                <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {headerSubtitle}
                </p>
              )}
            </div>
            {actionButton && <div className="flex items-center gap-3">{actionButton}</div>}
          </header>
        )}

        <div className="flex-1 w-full max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
