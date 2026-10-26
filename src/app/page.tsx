'use client'

import Link from 'next/link'
import { LuSparkles, LuUpload, LuBrain, LuChartBar, LuCalendarCheck, LuMessageCircle, LuTrendingUp, LuArrowRight, LuChevronRight } from 'react-icons/lu'

const features = [
  {
    icon: LuUpload,
    title: 'Upload Materials',
    description: 'Upload your syllabus, notes, textbooks, and past papers. GapFinder AI processes and understands your specific study content.',
    color: '#7c5cfc',
  },
  {
    icon: LuBrain,
    title: 'Diagnostic Quiz',
    description: 'AI generates questions from YOUR material — not generic questions. Every question cites the exact source section.',
    color: '#5ce1e6',
  },
  {
    icon: LuChartBar,
    title: 'Gap Report',
    description: 'See exactly which topics are weak, medium, or strong — with specific reasoning for each rating based on your performance.',
    color: '#ff6bcb',
  },
  {
    icon: LuCalendarCheck,
    title: 'Revision Plan',
    description: 'Get a prioritized study plan that allocates more time to weak topics. Tell it how many hours you have, and it plans for you.',
    color: '#4ade80',
  },
  {
    icon: LuMessageCircle,
    title: 'AI Assistant',
    description: 'Ask questions about your material and get answers with citations. Like a tutor who has read everything you uploaded.',
    color: '#fbbf24',
  },
  {
    icon: LuTrendingUp,
    title: 'Track Progress',
    description: 'Watch your knowledge gaps close over time. Retake quizzes and see your improvement across all topics.',
    color: '#f87171',
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-static" style={{ borderRadius: 0, borderTop: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'var(--gradient-primary)' }}>
              <LuSparkles size={18} className="text-white" />
            </div>
            <span className="text-lg sm:text-xl font-bold gradient-text">GapFinder AI</span>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <Link href="/auth/login" className="btn-secondary text-xs sm:text-sm py-2 px-3 sm:px-5" id="login-nav-btn">
              Log In
            </Link>
            <Link href="/auth/signup" className="btn-primary text-xs sm:text-sm py-2 px-3 sm:px-5" id="signup-nav-btn">
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="pt-28 sm:pt-36 pb-16 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6 animate-fadeIn"
            style={{ background: 'rgba(124, 92, 252, 0.1)', border: '1px solid rgba(124, 92, 252, 0.3)' }}>
            <LuSparkles size={14} style={{ color: 'var(--accent-primary)' }} />
            <span className="text-xs sm:text-sm font-medium" style={{ color: 'var(--accent-primary)' }}>
              AI-Powered Study Diagnosis
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-7xl font-extrabold leading-tight mb-6 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
            Find What You{' '}
            <span className="gradient-text">Don&apos;t Know</span>
            <br />
            Before The Exam Finds It
          </h1>

          <p className="text-base sm:text-lg md:text-xl max-w-2xl mx-auto mb-10 animate-fadeIn" style={{ color: 'var(--text-secondary)', animationDelay: '0.2s' }}>
            Upload your study materials. Take a diagnostic quiz. Get a clear picture of your weak areas and a personalized revision plan — all powered by AI grounded in YOUR content.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fadeIn" style={{ animationDelay: '0.3s' }}>
            <Link href="/auth/signup" className="btn-primary text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4 flex items-center justify-center gap-2 w-full sm:w-auto" id="hero-cta">
              Start Finding Your Gaps
              <LuArrowRight size={20} />
            </Link>
            <Link href="#features" className="btn-secondary text-base sm:text-lg px-6 sm:px-8 py-3.5 sm:py-4 w-full sm:w-auto text-center" id="learn-more-btn">
              Learn More
            </Link>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mt-16 animate-fadeIn" style={{ animationDelay: '0.4s' }}>
            {[
              { value: 'RAG', label: 'Powered' },
              { value: '100%', label: 'Your Material' },
              { value: 'AI', label: 'Diagnosed' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl font-bold gradient-text">{stat.value}</div>
                <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6" id="how-it-works">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              How <span className="gradient-text">GapFinder</span> Works
            </h2>
            <p style={{ color: 'var(--text-secondary)' }} className="max-w-xl mx-auto">
              Three steps to discover and fix your knowledge gaps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Upload Your Material',
                desc: 'Syllabus, notes, textbooks, past papers — anything you need to study. We chunk and embed it for AI retrieval.',
                gradient: 'linear-gradient(135deg, #7c5cfc, #5ce1e6)',
              },
              {
                step: '02',
                title: 'Take a Diagnostic Quiz',
                desc: 'AI generates questions from your content with citations. Answer them to reveal what you actually know.',
                gradient: 'linear-gradient(135deg, #5ce1e6, #ff6bcb)',
              },
              {
                step: '03',
                title: 'Get Your Gap Report',
                desc: 'See weak, medium, and strong topics with AI-explained reasons. Then get a personalized revision plan.',
                gradient: 'linear-gradient(135deg, #ff6bcb, #7c5cfc)',
              },
            ].map((item) => (
              <div key={item.step} className="glass p-8 relative overflow-hidden group">
                <div className="absolute top-0 right-0 text-8xl font-black opacity-5 -mr-4 -mt-4"
                  style={{ color: 'var(--accent-primary)' }}>
                  {item.step}
                </div>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 text-white font-bold"
                  style={{ background: item.gradient }}>
                  {item.step}
                </div>
                <h3 className="text-xl font-semibold mb-3">{item.title}</h3>
                <p style={{ color: 'var(--text-secondary)' }} className="text-sm leading-relaxed">{item.desc}</p>
                <LuChevronRight className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: 'var(--accent-primary)' }} size={20} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6" id="features">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need to{' '}
              <span className="gradient-text-secondary">Study Smarter</span>
            </h2>
            <p style={{ color: 'var(--text-secondary)' }} className="max-w-xl mx-auto">
              Not a chatbot. A diagnostic tool that finds your gaps.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
            {features.map((feature) => (
              <div key={feature.title} className="glass p-6 group">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                  style={{ background: `${feature.color}20`, color: feature.color }}>
                  <feature.icon size={24} />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="glass p-12 relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" style={{ background: 'var(--gradient-primary)' }} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">
                Ready to Find Your Gaps?
              </h2>
              <p className="mb-8" style={{ color: 'var(--text-secondary)' }}>
                Stop studying everything equally. Start studying what matters.
              </p>
              <Link href="/auth/signup" className="btn-primary text-lg px-10 py-4 inline-flex items-center gap-2" id="final-cta">
                Get Started Free
                <LuArrowRight size={20} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-6 border-t" style={{ borderColor: 'var(--border-glass)' }}>
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LuSparkles size={16} style={{ color: 'var(--accent-primary)' }} />
            <span className="text-sm font-medium gradient-text">GapFinder AI</span>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Built with RAG • Powered by Gemini
          </p>
        </div>
      </footer>
    </div>
  )
}
