'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import {
  LuTrendingUp,
  LuBrain,
  LuAward,
  LuCalendarCheck,
  LuArrowUpRight,
  LuLoader,
  LuHistory,
  LuLayers,
} from 'react-icons/lu'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts'

interface ProgressStats {
  totalQuizzes: number
  completedQuizzes: number
  totalQuestions: number
  totalCorrect: number
  overallAccuracy: number
  weakTopics: number
  mediumTopics: number
  strongTopics: number
}

interface TopicItem {
  id: string
  name: string
  strength: 'weak' | 'medium' | 'strong' | 'untested'
  score: number
}

interface HistoryItem {
  id: string
  topic_name: string
  score: number
  strength: 'weak' | 'medium' | 'strong'
  recorded_at: string
}

interface QuizRecord {
  id: string
  title: string
  total_questions: number
  correct_answers: number
  status: string
  created_at: string
}

export default function ProgressDashboardPage() {
  const [stats, setStats] = useState<ProgressStats | null>(null)
  const [topics, setTopics] = useState<TopicItem[]>([])
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [quizzes, setQuizzes] = useState<QuizRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchProgress = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/progress')
      if (res.ok) {
        const data = await res.json()
        setStats(data.stats)
        setTopics(data.topics || [])
        setHistory(data.history || [])
        setQuizzes(data.quizzes || [])
      }
    } catch (err) {
      console.error('Failed to load progress:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProgress()
  }, [])

  // Format data for Recharts
  const topicChartData = topics.map((t) => ({
    name: t.name.length > 18 ? t.name.slice(0, 18) + '...' : t.name,
    score: t.score,
    fullName: t.name,
    strength: t.strength,
  }))

  const timelineData = quizzes.slice(-6).map((q, idx) => ({
    name: `Quiz #${idx + 1}`,
    accuracy: q.total_questions > 0 ? Math.round((q.correct_answers / q.total_questions) * 100) : 0,
    title: q.title,
  }))

  return (
    <AppLayout
      headerTitle="Progress & Improvement Dashboard"
      headerSubtitle="Track your trajectory from identified gaps to verified topic mastery"
      actionButton={
        <Link href="/quiz" className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3">
          <LuBrain size={14} />
          <span>New Diagnostic Quiz</span>
        </Link>
      }
    >
      <div className="space-y-8 pb-12">
        {/* Metric Cards Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          <div className="glass p-5">
            <span className="text-xs uppercase tracking-wider text-purple-400 font-semibold">
              Quizzes Taken
            </span>
            <div className="text-3xl font-extrabold text-white mt-3">
              {stats?.completedQuizzes ?? 0}
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Diagnostic assessments completed
            </p>
          </div>

          <div className="glass p-5">
            <span className="text-xs uppercase tracking-wider text-cyan-400 font-semibold">
              Cumulative Accuracy
            </span>
            <div className="text-3xl font-extrabold text-cyan-400 mt-3">
              {stats?.overallAccuracy ?? 0}%
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              {stats?.totalCorrect ?? 0} / {stats?.totalQuestions ?? 0} questions correct
            </p>
          </div>

          <div className="glass p-5">
            <span className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
              Mastered Topics
            </span>
            <div className="text-3xl font-extrabold text-emerald-400 mt-3">
              {stats?.strongTopics ?? 0}
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Above 70% proficiency
            </p>
          </div>

          <div className="glass p-5">
            <span className="text-xs uppercase tracking-wider text-red-400 font-semibold">
              Active Gaps
            </span>
            <div className="text-3xl font-extrabold text-red-400 mt-3">
              {stats?.weakTopics ?? 0}
            </div>
            <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
              Scheduled in revision plan
            </p>
          </div>
        </div>

        {/* Charts Section */}
        {loading ? (
          <div className="glass p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-3">
            <LuLoader className="animate-spin" size={24} />
            <span>Calculating historical learning analytics...</span>
          </div>
        ) : (
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Topic Mastery Bar Chart */}
            <div className="lg:col-span-7 glass p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <LuLayers className="text-purple-400" />
                    Topic Mastery Distribution (%)
                  </h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    Diagnosed scores per syllabus module
                  </p>
                </div>
                <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                  <LuArrowUpRight size={14} /> Real-time
                </span>
              </div>

              {topicChartData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-gray-500">
                  No topic scores available yet
                </div>
              ) : (
                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topicChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#6b6b99" fontSize={10} tickLine={false} />
                      <YAxis domain={[0, 100]} stroke="#6b6b99" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111227',
                          borderColor: 'rgba(124, 92, 252, 0.3)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Bar dataKey="score" fill="#7c5cfc" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Accuracy Trajectory Line Chart */}
            <div className="lg:col-span-5 glass p-6 space-y-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <LuTrendingUp className="text-cyan-400" />
                  Accuracy Over Quiz Attempts
                </h3>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  How your scores evolve across tests
                </p>
              </div>

              {timelineData.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-xs text-gray-500">
                  Take at least one quiz to view accuracy trajectory
                </div>
              ) : (
                <div className="h-64 w-full pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="name" stroke="#6b6b99" fontSize={10} tickLine={false} />
                      <YAxis domain={[0, 100]} stroke="#6b6b99" fontSize={10} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111227',
                          borderColor: 'rgba(92, 225, 230, 0.3)',
                          borderRadius: '8px',
                          fontSize: '12px',
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="accuracy"
                        stroke="#5ce1e6"
                        strokeWidth={3}
                        dot={{ fill: '#5ce1e6', r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recent Quiz Attempts Table */}
        <div className="glass p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <LuHistory className="text-purple-400" />
              Recent Quiz History
            </h3>
            <Link href="/quiz" className="text-xs text-purple-400 hover:underline">
              Take Another Quiz &rarr;
            </Link>
          </div>

          {quizzes.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-500">
              No quizzes recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="pb-3 font-semibold uppercase tracking-wider">Assessment Title</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Score</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Accuracy</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider">Status</th>
                    <th className="pb-3 font-semibold uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {quizzes.map((q) => {
                    const acc =
                      q.total_questions > 0
                        ? Math.round((q.correct_answers / q.total_questions) * 100)
                        : 0
                    return (
                      <tr key={q.id} className="hover:bg-white/[0.02]">
                        <td className="py-3 font-medium text-white">{q.title}</td>
                        <td className="py-3 text-gray-300">
                          {q.correct_answers} / {q.total_questions}
                        </td>
                        <td className="py-3 font-semibold text-purple-300">{acc}%</td>
                        <td className="py-3">
                          <span className="badge badge-strong capitalize">{q.status}</span>
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href={`/gap-report?quizId=${q.id}`}
                            className="text-purple-400 hover:text-purple-300 font-semibold"
                          >
                            View Diagnosis &rarr;
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
