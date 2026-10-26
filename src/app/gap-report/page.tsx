'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import {
  LuChartBar,
  LuTriangleAlert,
  LuCircleCheck,
  LuCircleHelp,
  LuCalendarCheck,
  LuSparkles,
  LuArrowRight,
  LuLoader,
  LuBrain,
  LuLightbulb,
} from 'react-icons/lu'

interface GapReportItem {
  id: string
  quiz_id: string
  topic_id: string
  topic_name: string
  strength: 'weak' | 'medium' | 'strong'
  score: number
  total_questions: number
  correct_answers: number
  reason: string
  suggestions: string[]
  created_at: string
}

export default function GapReportPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-400">Loading gap analysis...</div>}>
      <GapReportContent />
    </Suspense>
  )
}

function GapReportContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const quizIdFilter = searchParams.get('quizId')

  const [reports, setReports] = useState<GapReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'weak' | 'medium' | 'strong'>('all')
  const [availableHours, setAvailableHours] = useState(8)
  const [generatingPlan, setGeneratingPlan] = useState(false)

  const fetchReports = async () => {
    try {
      setLoading(true)
      const url = quizIdFilter ? `/api/gap-analysis?quizId=${quizIdFilter}` : '/api/gap-analysis'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setReports(data.reports || [])
      }
    } catch (err) {
      console.error('Error fetching gap reports:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [quizIdFilter])

  const handleGenerateRevisionPlan = async () => {
    try {
      setGeneratingPlan(true)
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableHours }),
      })
      if (res.ok) {
        router.push('/revision-plan')
      } else {
        alert('Failed to generate revision plan.')
      }
    } catch (err) {
      console.error('Plan generation error:', err)
    } finally {
      setGeneratingPlan(false)
    }
  }

  const filteredReports = reports.filter((r) => {
    if (filter === 'all') return true
    return r.strength === filter
  })

  const weakCount = reports.filter((r) => r.strength === 'weak').length
  const mediumCount = reports.filter((r) => r.strength === 'medium').length
  const strongCount = reports.filter((r) => r.strength === 'strong').length

  return (
    <AppLayout
      headerTitle="Curriculum Gap Diagnosis"
      headerSubtitle="Topic-level breakdown of your strengths, conceptual blindspots, and recommended remediation"
      actionButton={
        <div className="flex items-center gap-2">
          <Link href="/quiz" className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5">
            <LuBrain size={14} />
            <span>Retake Diagnostic Quiz</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-8 pb-12">
        {/* Revision Plan Quick-Launcher Banner */}
        <div className="glass p-6 border-l-4 border-l-purple-500 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
              <LuSparkles size={14} /> Actionable Remediation
            </div>
            <h3 className="text-xl font-bold text-white">
              Turn This Diagnosis Into A Personalized Revision Plan
            </h3>
            <p className="text-xs max-w-xl" style={{ color: 'var(--text-secondary)' }}>
              How many hours do you have before your test? GapFinder AI will allocate more time to your weak topics and give you a prioritized daily schedule.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <span className="text-xs text-gray-400">Available:</span>
              <input
                type="number"
                min={1}
                max={100}
                value={availableHours}
                onChange={(e) => setAvailableHours(Math.max(1, Number(e.target.value)))}
                className="w-14 bg-transparent text-sm font-bold text-white text-center outline-none"
              />
              <span className="text-xs text-purple-400 font-semibold">Hours</span>
            </div>

            <button
              onClick={handleGenerateRevisionPlan}
              disabled={generatingPlan || reports.length === 0}
              className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4"
              id="generate-plan-from-gap-btn"
            >
              {generatingPlan ? (
                <>
                  <LuLoader className="animate-spin" size={16} />
                  <span>Generating Schedule...</span>
                </>
              ) : (
                <>
                  <LuCalendarCheck size={16} />
                  <span>Build Revision Plan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filter Pills and Summary Count */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: `All Topics (${reports.length})` },
              { id: 'weak', label: `Weak Gaps (${weakCount})`, color: 'text-red-400' },
              { id: 'medium', label: `Medium Review (${mediumCount})`, color: 'text-amber-400' },
              { id: 'strong', label: `Mastered (${strongCount})`, color: 'text-emerald-400' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  filter === f.id
                    ? 'bg-purple-500/20 text-white border border-purple-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-white border border-transparent'
                } ${f.color || ''}`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="text-xs text-gray-400">
            Showing {filteredReports.length} diagnostic assessments
          </div>
        </div>

        {/* Gap Cards List */}
        {loading ? (
          <div className="glass p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-3">
            <LuLoader className="animate-spin" size={24} />
            <span>Analyzing student conceptual gaps & diagnostic answers...</span>
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="glass p-12 text-center space-y-4">
            <LuChartBar className="mx-auto text-gray-500" size={48} />
            <div>
              <h3 className="text-base font-bold text-white">No Diagnostic Reports Found</h3>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Take a diagnostic quiz to generate your first knowledge gap diagnosis, or preload sample course data.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Link href="/quiz" className="btn-primary text-xs py-2 px-4">
                Take Diagnostic Quiz
              </Link>
              <Link href="/dashboard" className="btn-secondary text-xs py-2 px-4">
                Preload Demo Course
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {filteredReports.map((report) => (
              <div
                key={report.id}
                className={`glass p-6 md:p-8 space-y-5 border transition-all ${
                  report.strength === 'weak'
                    ? 'border-red-500/30 shadow-lg shadow-red-500/5'
                    : report.strength === 'medium'
                    ? 'border-amber-500/30'
                    : 'border-emerald-500/30'
                }`}
              >
                {/* Header row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-white">{report.topic_name}</h3>
                      {report.strength === 'weak' && (
                        <span className="badge badge-weak flex items-center gap-1">
                          <LuTriangleAlert size={12} />
                          <span>Critical Gap</span>
                        </span>
                      )}
                      {report.strength === 'medium' && (
                        <span className="badge badge-medium flex items-center gap-1">
                          <LuCircleHelp size={12} />
                          <span>Needs Review</span>
                        </span>
                      )}
                      {report.strength === 'strong' && (
                        <span className="badge badge-strong flex items-center gap-1">
                          <LuCircleCheck size={12} />
                          <span>Solid Mastery</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Quiz accuracy: {report.correct_answers} of {report.total_questions} questions correct ({report.score}%)
                    </p>
                  </div>

                  <Link
                    href={`/assistant?query=${encodeURIComponent(report.topic_name)}`}
                    className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 self-start sm:self-auto"
                  >
                    <span>Explain Topic With AI</span>
                    <LuArrowRight size={14} />
                  </Link>
                </div>

                {/* AI Reasoning for the Diagnosis */}
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <LuSparkles size={14} />
                    <span>AI Diagnostic Reasoning</span>
                  </div>
                  <p className="text-xs md:text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {report.reason}
                  </p>
                </div>

                {/* Suggestions List */}
                {report.suggestions && report.suggestions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                      <LuLightbulb size={14} />
                      <span>Recommended Remediation Steps</span>
                    </div>
                    <ul className="grid sm:grid-cols-2 gap-2 text-xs">
                      {report.suggestions.map((sug, sIdx) => (
                        <li
                          key={sIdx}
                          className="p-3 rounded-lg border border-white/5 bg-white/[0.01] flex items-start gap-2"
                        >
                          <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] shrink-0 font-bold mt-0.5">
                            {sIdx + 1}
                          </span>
                          <span style={{ color: 'var(--text-secondary)' }}>{sug}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
