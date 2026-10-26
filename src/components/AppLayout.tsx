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
    <div className="min-h-screen flex w-full">
      <Sidebar />

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col p-4 md:p-8 pt-18 md:pt-8 w-full overflow-x-hidden">
        {/* Top Header if provided */}
        {(headerTitle || actionButton) && (
          <header className="glass p-5 md:p-6 mb-6 md:mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4 animate-fadeIn">
            <div className="min-w-0 flex-1">
              {headerTitle && (
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold gradient-text break-words">
                  {headerTitle}
                </h1>
              )}
              {headerSubtitle && (
                <p className="text-xs sm:text-sm mt-1 break-words" style={{ color: 'var(--text-secondary)' }}>
                  {headerSubtitle}
                </p>
              )}
            </div>
            {actionButton && (
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap shrink-0">
                {actionButton}
              </div>
            )}
          </header>
        )}

        <div className="flex-1 w-full max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  )
}
