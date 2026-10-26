'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import {
  LuCalendarCheck,
  LuClock,
  LuCircleCheck,
  LuSparkles,
  LuArrowRight,
  LuBookOpen,
  LuLoader,
  LuRotateCcw,
  LuLayers,
} from 'react-icons/lu'

interface PlanItem {
  topic_name: string
  priority: 'high' | 'medium' | 'low'
  estimated_hours: number
  activities: string[]
  resources: string[]
  completed: boolean
  strength: 'weak' | 'medium' | 'strong'
}

interface RevisionPlanRecord {
  id: string
  title: string
  available_hours: number
  status: 'active' | 'completed' | 'archived'
  plan_data: PlanItem[]
  created_at: string
}

export default function RevisionPlanPage() {
  const [plans, setPlans] = useState<RevisionPlanRecord[]>([])
  const [activePlan, setActivePlan] = useState<RevisionPlanRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoursInput, setHoursInput] = useState(10)
  const [generating, setGenerating] = useState(false)

  const fetchPlans = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/plan')
      if (res.ok) {
        const data = await res.json()
        const planList: RevisionPlanRecord[] = data.plans || []
        setPlans(planList)
        if (planList.length > 0) {
          setActivePlan(planList[0])
          setHoursInput(planList[0].available_hours || 10)
        }
      }
    } catch (err) {
      console.error('Error fetching plans:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleGenerateNewPlan = async () => {
    try {
      setGenerating(true)
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availableHours: hoursInput }),
      })
      const data = await res.json()
      if (res.ok && data.plan) {
        setActivePlan(data.plan)
        setPlans((prev) => [data.plan, ...prev])
      } else {
        alert(data.error || 'Could not generate plan. Please take a diagnostic quiz first!')
      }
    } catch (err) {
      console.error('Plan generation error:', err)
    } finally {
      setGenerating(false)
    }
  }

  const toggleActivityCompletion = async (itemIdx: number) => {
    if (!activePlan) return
    const updatedPlanData = [...activePlan.plan_data]
    updatedPlanData[itemIdx] = {
      ...updatedPlanData[itemIdx],
      completed: !updatedPlanData[itemIdx].completed,
    }

    // Check if all are completed
    const allDone = updatedPlanData.every((i) => i.completed)
    const newStatus = allDone ? 'completed' : 'active'

    setActivePlan({
      ...activePlan,
      plan_data: updatedPlanData,
      status: newStatus,
    })

    try {
      await fetch('/api/plan', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: activePlan.id,
          planData: updatedPlanData,
          status: newStatus,
        }),
      })
    } catch (err) {
      console.error('Error updating plan:', err)
    }
  }

  const totalTasks = activePlan?.plan_data?.length || 0
  const completedTasks = activePlan?.plan_data?.filter((p) => p.completed)?.length || 0
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <AppLayout
      headerTitle="Personalized Revision Plan"
      headerSubtitle="Prioritized study schedule allocating maximum hours to identified knowledge gaps"
    >
      <div className="space-y-8 pb-12">
        {/* Study Hours Reconfiguration Bar */}
        <div className="glass p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <LuClock className="text-purple-400" />
              Tune Available Revision Hours
            </h3>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Got an exam in 2 days? Change your hour budget and Gemini will recalculate topic allocations immediately.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl px-3 py-2">
              <input
                type="number"
                min={1}
                max={100}
                value={hoursInput}
                onChange={(e) => setHoursInput(Math.max(1, Number(e.target.value)))}
                className="w-14 bg-transparent text-sm font-bold text-white text-center outline-none"
              />
              <span className="text-xs text-purple-400 font-semibold">Hours Budget</span>
            </div>

            <button
              onClick={handleGenerateNewPlan}
              disabled={generating}
              className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4"
              id="recalculate-plan-btn"
            >
              {generating ? (
                <>
                  <LuLoader className="animate-spin" size={16} />
                  <span>Optimizing...</span>
                </>
              ) : (
                <>
                  <LuSparkles size={16} />
                  <span>Re-Generate Plan</span>
                </>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="glass p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-3">
            <LuLoader className="animate-spin" size={24} />
            <span>Loading customized revision schedule...</span>
          </div>
        ) : !activePlan ? (
          <div className="glass p-12 text-center space-y-4">
            <LuCalendarCheck className="mx-auto text-gray-500" size={48} />
            <div>
              <h3 className="text-base font-bold text-white">No Revision Plan Generated Yet</h3>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                A revision plan requires diagnostic data. Take a quiz or preload sample course data to generate a prioritized plan.
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
            {/* Plan Header & Progress Bar */}
            <div className="glass p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mb-2">
                    <LuCircleCheck size={12} /> Active Study Roadmap
                  </div>
                  <h2 className="text-xl font-bold text-white">{activePlan.title}</h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Total Budget: {activePlan.available_hours} hours • {completedTasks} of {totalTasks} topics completed
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-2xl font-extrabold text-purple-400">{progressPercent}%</span>
                  <div className="text-[10px] text-gray-400">Roadmap Progress</div>
                </div>
              </div>

              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>

            {/* Plan Items List */}
            <div className="space-y-4">
              {activePlan.plan_data.map((item, idx) => {
                const isHigh = item.priority === 'high'
                const isMedium = item.priority === 'medium'

                return (
                  <div
                    key={idx}
                    className={`glass p-6 transition-all border ${
                      item.completed
                        ? 'border-white/5 opacity-60 bg-black/30'
                        : isHigh
                        ? 'border-red-500/30 bg-red-500/[0.02]'
                        : isMedium
                        ? 'border-amber-500/30 bg-amber-500/[0.02]'
                        : 'border-emerald-500/20'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => toggleActivityCompletion(idx)}
                          className={`mt-1 w-6 h-6 rounded-lg border flex items-center justify-center transition-colors shrink-0 ${
                            item.completed
                              ? 'bg-emerald-500 border-emerald-400 text-white'
                              : 'border-gray-500 hover:border-purple-400'
                          }`}
                          title="Mark topic completed"
                        >
                          {item.completed && <LuCircleCheck size={16} />}
                        </button>

                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3
                              className={`text-base font-bold ${
                                item.completed ? 'line-through text-gray-400' : 'text-white'
                              }`}
                            >
                              {item.topic_name}
                            </h3>

                            {isHigh && (
                              <span className="badge badge-weak text-[10px]">High Priority Gap</span>
                            )}
                            {isMedium && (
                              <span className="badge badge-medium text-[10px]">Medium Priority</span>
                            )}
                            {!isHigh && !isMedium && (
                              <span className="badge badge-strong text-[10px]">Low Review</span>
                            )}
                          </div>

                          <p className="text-xs text-purple-300 font-semibold flex items-center gap-1">
                            <LuClock size={12} />
                            <span>Allocated: {item.estimated_hours} Hours</span>
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/assistant?query=${encodeURIComponent(
                          `Can you guide me through my revision for ${item.topic_name}? Focus on: ${item.activities.join(
                            ', '
                          )}`
                        )}`}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1 self-start shrink-0"
                      >
                        <LuSparkles size={14} className="text-purple-400" />
                        <span>Revise With AI</span>
                      </Link>
                    </div>

                    {/* Step-by-Step Activities */}
                    <div className="space-y-2 mt-4 pt-4 border-t border-white/5">
                      <div className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                        <LuLayers size={13} /> Recommended Revision Activities:
                      </div>
                      <div className="grid md:grid-cols-2 gap-2 text-xs">
                        {item.activities.map((act, aIdx) => (
                          <div
                            key={aIdx}
                            className="p-3 rounded-lg border border-white/5 bg-white/[0.01] flex items-start gap-2"
                          >
                            <span className="text-purple-400 font-bold shrink-0">{aIdx + 1}.</span>
                            <span style={{ color: 'var(--text-secondary)' }}>{act}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Source Resources to Read */}
                    {item.resources && item.resources.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-gray-400">
                        <span className="flex items-center gap-1 text-purple-300 font-semibold">
                          <LuBookOpen size={13} /> Targeted Sections:
                        </span>
                        {item.resources.map((res, rIdx) => (
                          <span
                            key={rIdx}
                            className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-gray-300"
                          >
                            {res}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
