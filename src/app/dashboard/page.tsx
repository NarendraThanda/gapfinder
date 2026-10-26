'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import {
  LuBrain,
  LuUpload,
  LuCalendarCheck,
  LuMessageCircle,
  LuTriangleAlert,
  LuCircleCheck,
  LuSparkles,
  LuArrowRight,
  LuRefreshCw,
  LuFileText,
  LuAward,
} from 'react-icons/lu'

interface DashboardStats {
  totalQuizzes: number
  completedQuizzes: number
  totalQuestions: number
  totalCorrect: number
  overallAccuracy: number
  weakTopics: number
  mediumTopics: number
  strongTopics: number
  untestedTopics: number
}

interface TopicItem {
  id: string
  name: string
  strength: 'weak' | 'medium' | 'strong' | 'untested'
  score: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [loading, setLoading] = useState(true)
  const [seeding, setSeeding] = useState(false)
  const [seedSuccess, setSeedSuccess] = useState('')

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/progress')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setTopics(data.topics || [])
      }
    } catch (err) {
      console.error('Error fetching dashboard:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const handleSeedDemo = async () => {
    try {
      setSeeding(true)
      setSeedSuccess('')
      const res = await fetch('/api/seed-demo', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setSeedSuccess('Demo syllabus, diagnostic quiz & revision plan preloaded successfully!')
        await fetchDashboardData()
      } else {
        setSeedSuccess(data.error || 'Failed to preload data.')
      }
    } catch {
      setSeedSuccess('Error communicating with demo seeder.')
    } finally {
      setSeeding(false)
    }
  }

  const weakList = topics.filter((t) => t.strength === 'weak')
  const mediumList = topics.filter((t) => t.strength === 'medium')
  const strongList = topics.filter((t) => t.strength === 'strong')

  return (
    <AppLayout
      headerTitle="Diagnosis Dashboard"
      headerSubtitle="Real-time analysis of your knowledge gaps grounded in your materials"
      actionButton={
        <button
          onClick={handleSeedDemo}
          disabled={seeding}
          className="btn-secondary flex items-center gap-2 text-xs md:text-sm py-2 px-3"
          id="preload-demo-btn"
        >
          <LuSparkles size={16} className={seeding ? 'animate-spin' : 'text-purple-400'} />
          {seeding ? 'Preloading Sample Material...' : '⚡ Preload Sample Course (Judge Mode)'}
        </button>
      }
    >
      <div className="space-y-8 pb-12">
        {/* Banner Alert for Preload status */}
        {seedSuccess && (
          <div
            className="p-4 rounded-xl flex items-center justify-between animate-fadeIn text-sm"
            style={{
              background: 'rgba(74, 222, 128, 0.1)',
              border: '1px solid rgba(74, 222, 128, 0.3)',
              color: 'var(--accent-success)',
            }}
          >
            <div className="flex items-center gap-2">
              <LuCircleCheck size={18} />
              <span>{seedSuccess}</span>
            </div>
            <button onClick={() => setSeedSuccess('')} className="underline text-xs">
              Dismiss
            </button>
          </div>
        )}

        {/* Hero Diagnosis Callout */}
        <div className="glass p-8 relative overflow-hidden group">
          <div
            className="absolute top-0 right-0 w-96 h-96 opacity-10 blur-3xl pointer-events-none"
            style={{ background: 'var(--gradient-primary)' }}
          />

          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
            <div className="space-y-3 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/20">
                <LuSparkles size={14} /> Diagnostic Engine Active
              </div>
              <h2 className="text-3xl font-extrabold text-white">
                Stop Revising What You Already Know.
              </h2>
              <p className="text-sm md:text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Traditional study apps wait for you to ask questions. GapFinder AI runs diagnostic assessments on your syllabus and uncovers the blindspots you didn&apos;t know you had.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/quiz" className="btn-primary flex items-center gap-2" id="start-quiz-btn">
                <LuBrain size={18} />
                <span>Take Diagnostic Quiz</span>
                <LuArrowRight size={16} />
              </Link>
              <Link href="/materials" className="btn-secondary flex items-center gap-2" id="upload-materials-btn">
                <LuUpload size={18} />
                <span>Add Materials</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="glass p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-red-400">
                Weak Topics
              </span>
              <span className="p-2 rounded-lg bg-red-500/10 text-red-400">
                <LuTriangleAlert size={18} />
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-red-400">
                {stats?.weakTopics ?? 0}
              </span>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Requires urgent revision
              </p>
            </div>
          </div>

          <div className="glass p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-amber-400">
                Medium Topics
              </span>
              <span className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <LuRefreshCw size={18} />
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-amber-400">
                {stats?.mediumTopics ?? 0}
              </span>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Partial conceptual grasp
              </p>
            </div>
          </div>

          <div className="glass p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-emerald-400">
                Mastered Topics
              </span>
              <span className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <LuCircleCheck size={18} />
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-emerald-400">
                {stats?.strongTopics ?? 0}
              </span>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Solid foundation (&gt;70%)
              </p>
            </div>
          </div>

          <div className="glass p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wider font-semibold text-cyan-400">
                Overall Accuracy
              </span>
              <span className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <LuAward size={18} />
              </span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-extrabold text-cyan-400">
                {stats?.overallAccuracy ?? 0}%
              </span>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Across {stats?.completedQuizzes ?? 0} quiz assessments
              </p>
            </div>
          </div>
        </div>

        {/* Urgent Action Section: Knowledge Gap Diagnosis */}
        {weakList.length > 0 && (
          <div
            className="p-6 rounded-2xl glass-static border border-red-500/30"
            style={{ background: 'rgba(248, 113, 113, 0.05)' }}
          >
            <div className="flex items-start justify-between flex-wrap gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-red-500/20 text-red-400 mt-1">
                  <LuTriangleAlert size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-red-300">
                    High Priority Gap Detected: {weakList[0].name}
                  </h3>
                  <p className="text-sm mt-1 max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
                    Your diagnostic quiz answers revealed conceptual misunderstandings in this topic. We recommend reviewing your personalized revision plan right away.
                  </p>
                </div>
              </div>
              <Link href="/gap-report" className="btn-primary text-sm py-2 px-4" id="view-gap-btn">
                Inspect Gap Report
              </Link>
            </div>
          </div>
        )}

        {/* Feature Pathways */}
        <div className="grid md:grid-cols-3 gap-6">
          <Link href="/gap-report" className="glass p-6 group block">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-purple-500/10 text-purple-400 group-hover:scale-105 transition-transform">
              <LuBrain size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-purple-400 transition-colors">
              Detailed Gap Analysis
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              See topic-by-topic reasons explaining why your answers were marked weak, complete with source citations.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-purple-400">
              <span>View Diagnosis</span>
              <LuArrowRight size={14} />
            </div>
          </Link>

          <Link href="/revision-plan" className="glass p-6 group block">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
              <LuCalendarCheck size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">
              Personalized Revision Plan
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              A prioritized study schedule based on your available hours, allocating time where you need it most.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-emerald-400">
              <span>Follow Schedule</span>
              <LuArrowRight size={14} />
            </div>
          </Link>

          <Link href="/assistant" className="glass p-6 group block">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 bg-cyan-500/10 text-cyan-400 group-hover:scale-105 transition-transform">
              <LuMessageCircle size={24} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
              Explain-This-Topic
            </h3>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Ask questions directly against your uploaded lecture notes and textbooks with strict factual citations.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-cyan-400">
              <span>Ask AI Tutor</span>
              <LuArrowRight size={14} />
            </div>
          </Link>
        </div>

        {/* Topic Breakdown Overview */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-white">Curriculum Topic Health</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Diagnosed from your course materials and diagnostic quizzes
              </p>
            </div>
            <Link href="/topics" className="text-xs font-medium text-purple-400 hover:underline">
              View Topic Map &rarr;
            </Link>
          </div>

          {topics.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <LuFileText className="mx-auto text-gray-500" size={36} />
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                No topics extracted yet. Upload your syllabus or click &quot;Preload Sample Course&quot; above!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {topics.map((t) => (
                <div
                  key={t.id}
                  className="p-4 rounded-xl flex items-center justify-between gap-4 border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="space-y-1">
                    <span className="text-sm font-semibold text-white">{t.name}</span>
                    <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>Current Diagnostic Score: {t.score}%</span>
                    </div>
                  </div>

                  <div>
                    {t.strength === 'weak' && (
                      <span className="badge badge-weak">Weak Gap</span>
                    )}
                    {t.strength === 'medium' && (
                      <span className="badge badge-medium">Review Needed</span>
                    )}
                    {t.strength === 'strong' && (
                      <span className="badge badge-strong">Mastered</span>
                    )}
                    {t.strength === 'untested' && (
                      <span className="badge bg-slate-500/10 text-slate-400 border border-slate-500/30">
                        Untested
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
