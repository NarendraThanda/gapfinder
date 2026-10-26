'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import MaterialContextSelector, { MaterialOption } from '@/components/MaterialContextSelector'
import {
  LuCalendarCheck,
  LuClock,
  LuCircleCheck,
  LuSparkles,
  LuBookOpen,
  LuLoader,
  LuLayers,
  LuTriangleAlert,
  LuCheck,
  LuHistory,
  LuBrain,
} from 'react-icons/lu'

interface PlanItem {
  topic_name: string
  priority: 'high' | 'medium' | 'low'
  estimated_hours: number
  activities: string[]
  resources: string[]
  completed: boolean
  strength: 'weak' | 'medium' | 'strong'
  suggestions?: string[]
  reason?: string
}

interface RevisionPlanRecord {
  id: string
  title: string
  available_hours: number
  status: 'active' | 'completed' | 'archived'
  plan_data: PlanItem[]
  created_at: string
}

// Client-side defensive helpers to guarantee rendering never throws on older/malformed DB records
function getSafeActivities(item: PlanItem): string[] {
  if (Array.isArray(item.activities) && item.activities.length > 0) {
    return item.activities.map(String)
  }
  if (Array.isArray(item.suggestions) && item.suggestions.length > 0) {
    return item.suggestions.map(String)
  }
  if (item.reason) {
    return [
      `Review key concepts: ${item.reason}`,
      'Solve targeted practice exercises and verify solutions',
    ]
  }
  return [
    'Review core lecture notes and key formulas',
    'Practice relevant exam-style problems',
  ]
}

function getSafeResources(item: PlanItem): string[] {
  if (Array.isArray(item.resources) && item.resources.length > 0) {
    return item.resources.map(String)
  }
  if (item.reason) {
    return [String(item.reason)]
  }
  return ['Course Materials & Lecture Notes']
}

function normalizeClientPlanItem(item: any, idx: number): PlanItem {
  const rawPriority = String(item?.priority || '').toLowerCase()
  const rawStrength = String(item?.strength || '').toLowerCase()

  const strength: 'weak' | 'medium' | 'strong' = ['weak', 'medium', 'strong'].includes(rawStrength)
    ? (rawStrength as 'weak' | 'medium' | 'strong')
    : rawPriority === 'high'
    ? 'weak'
    : rawPriority === 'low'
    ? 'strong'
    : 'medium'

  const priority: 'high' | 'medium' | 'low' = ['high', 'medium', 'low'].includes(rawPriority)
    ? (rawPriority as 'high' | 'medium' | 'low')
    : strength === 'weak'
    ? 'high'
    : strength === 'strong'
    ? 'low'
    : 'medium'

  const defaultHours = priority === 'high' ? 4 : priority === 'medium' ? 2.5 : 1.5
  const estimated_hours =
    typeof item?.estimated_hours === 'number' && item.estimated_hours > 0
      ? item.estimated_hours
      : defaultHours

  const activities = getSafeActivities(item)
  const resources = getSafeResources(item)

  return {
    topic_name: String(item?.topic_name || item?.name || `Topic ${idx + 1}`),
    priority,
    estimated_hours,
    activities,
    resources,
    completed: Boolean(item?.completed),
    strength,
    suggestions: item?.suggestions,
    reason: item?.reason,
  }
}

export default function RevisionPlanPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-400">Loading revision plan...</div>}>
      <RevisionPlanContent />
    </Suspense>
  )
}

function RevisionPlanContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlMaterialId = searchParams.get('materialId')

  const [plans, setPlans] = useState<RevisionPlanRecord[]>([])
  const [activePlan, setActivePlan] = useState<RevisionPlanRecord | null>(null)
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(urlMaterialId)
  const [activeMaterialTitle, setActiveMaterialTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hoursInput, setHoursInput] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)

  const fetchPlansAndMaterials = async (targetId?: string | null) => {
    try {
      setLoading(true)
      setStatusMessage(null)
      const storedId = typeof window !== 'undefined' ? localStorage.getItem('gapfinder_active_material_id') : null
      const effectiveMatId = targetId !== undefined ? targetId : (urlMaterialId || activeMaterialId || storedId)

      const [matRes, planRes] = await Promise.all([
        fetch('/api/materials'),
        fetch(`/api/plan${effectiveMatId && effectiveMatId !== 'all' ? `?materialId=${encodeURIComponent(effectiveMatId)}` : ''}`),
      ])

      let matList: MaterialOption[] = []
      if (matRes.ok) {
        const matData = await matRes.json()
        matList = matData.materials || []
        setMaterials(matList)
      }

      if (planRes.ok) {
        const data = await planRes.json()
        const rawList: RevisionPlanRecord[] = data.plans || []
        const normalizedList = rawList.map((p) => ({
          ...p,
          plan_data: (p.plan_data || []).map(normalizeClientPlanItem),
        }))
        setPlans(normalizedList)
        if (normalizedList.length > 0) {
          setActivePlan(normalizedList[0])
          setHoursInput(normalizedList[0].available_hours || 10)
        } else {
          setActivePlan(null)
        }

        const currentMatId = data.activeMaterialId || effectiveMatId || (matList.length > 0 ? matList[0].id : null)
        setActiveMaterialId(currentMatId)
        if (currentMatId && typeof window !== 'undefined') {
          localStorage.setItem('gapfinder_active_material_id', currentMatId)
        }
        const currentMat = matList.find((m) => m.id === currentMatId)
        if (currentMat) {
          setActiveMaterialTitle(currentMat.title)
        }
      } else {
        const errData = await planRes.json().catch(() => ({}))
        setStatusMessage({
          type: 'error',
          text: errData.error || 'Failed to load revision plans from server.',
        })
      }
    } catch (err: any) {
      console.error('Error fetching plans:', err)
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Network error fetching revision plans.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlansAndMaterials(urlMaterialId)
  }, [urlMaterialId])

  const handleMaterialChange = (matId: string) => {
    // Clear previous material's plans immediately to prevent cross-contamination
    setPlans([])
    setActivePlan(null)
    setActiveMaterialId(matId)
    if (typeof window !== 'undefined') {
      if (matId === 'all') {
        localStorage.removeItem('gapfinder_active_material_id')
      } else {
        localStorage.setItem('gapfinder_active_material_id', matId)
      }
      const url = new URL(window.location.href)
      if (matId === 'all') {
        url.searchParams.delete('materialId')
      } else {
        url.searchParams.set('materialId', matId)
      }
      window.history.replaceState({}, '', url.toString())
    }
    fetchPlansAndMaterials(matId)
  }

  const handleGenerateNewPlan = async () => {
    try {
      setGenerating(true)
      setStatusMessage(null)
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          availableHours: hoursInput,
          materialId: activeMaterialId,
        }),
      })

      const data = await res.json().catch(() => ({}))
      if (res.ok && data.plan) {
        const normalizedPlan: RevisionPlanRecord = {
          ...data.plan,
          plan_data: (data.plan.plan_data || []).map(normalizeClientPlanItem),
        }
        setActivePlan(normalizedPlan)
        setPlans((prev) => [normalizedPlan, ...prev])
        setStatusMessage({
          type: 'success',
          text: `Revision plan successfully generated for ${hoursInput} hours!`,
        })
      } else {
        setStatusMessage({
          type: 'error',
          text: data.error || 'Could not generate plan. Please try again.',
        })
      }
    } catch (err: any) {
      console.error('Plan generation error:', err)
      setStatusMessage({
        type: 'error',
        text: err?.message || 'Network error during plan generation.',
      })
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

    const allDone = updatedPlanData.every((i) => i.completed)
    const newStatus = allDone ? 'completed' : 'active'

    const updatedPlan: RevisionPlanRecord = {
      ...activePlan,
      plan_data: updatedPlanData,
      status: newStatus,
    }

    setActivePlan(updatedPlan)
    setPlans((prev) => prev.map((p) => (p.id === activePlan.id ? updatedPlan : p)))

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

  const planItems = (activePlan?.plan_data || []).map(normalizeClientPlanItem)
  const totalTasks = planItems.length
  const completedTasks = planItems.filter((p) => p.completed).length
  const progressPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0

  return (
    <AppLayout
      headerTitle="Personalized Revision Plan"
      headerSubtitle={
        activeMaterialTitle
          ? `Study schedule optimized for: ${activeMaterialTitle}`
          : 'Prioritized study schedule allocating maximum hours to identified knowledge gaps'
      }
      actionButton={
        <div className="flex items-center flex-wrap gap-2">
          {materials.length > 0 && (
            <MaterialContextSelector
              materials={materials}
              activeMaterialId={activeMaterialId}
              onSelectMaterial={handleMaterialChange}
            />
          )}
          <Link
            href={activeMaterialId && activeMaterialId !== 'all' ? `/quiz?materialId=${activeMaterialId}` : '/quiz'}
            className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5"
          >
            <LuBrain size={14} />
            <span>Retake Diagnostic Quiz</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-8 pb-12">
        {/* Status notification banner */}
        {statusMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm transition-all ${
              statusMessage.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {statusMessage.type === 'error' ? (
                <LuTriangleAlert size={18} className="text-red-400 shrink-0" />
              ) : (
                <LuCheck size={18} className="text-emerald-400 shrink-0" />
              )}
              <span>{statusMessage.text}</span>
            </div>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs opacity-70 hover:opacity-100 underline ml-2"
            >
              Dismiss
            </button>
          </div>
        )}

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

        {/* Plan History Switcher (if user has multiple saved plans) */}
        {plans.length > 1 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-400 flex items-center gap-1.5 font-medium mr-1">
              <LuHistory size={13} /> Saved Plans:
            </span>
            {plans.map((p) => {
              const isSelected = activePlan?.id === p.id
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setActivePlan(p)
                    setHoursInput(p.available_hours || 10)
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-purple-600/30 border-purple-500 text-white font-semibold shadow-sm'
                      : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {p.title || `${p.available_hours}h Plan`}
                </button>
              )
            })}
          </div>
        )}

        {loading ? (
          <div className="glass p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-3">
            <LuLoader className="animate-spin" size={24} />
            <span>Loading customized revision schedule...</span>
          </div>
        ) : !activePlan ? (
          <div className="glass p-12 text-center space-y-4">
            <LuCalendarCheck className="mx-auto text-gray-500" size={48} />
            <div>
              <h3 className="text-base font-bold text-white">
                {activeMaterialTitle
                  ? `No Revision Plan for "${activeMaterialTitle}" Yet`
                  : 'No Revision Plan Generated Yet'}
              </h3>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                {activeMaterialTitle
                  ? `Click below to create an AI-powered revision plan tailored to ${activeMaterialTitle}, or diagnose gaps first.`
                  : 'Click below to instantly create an AI-powered revision plan tailored to your study schedule.'}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                onClick={handleGenerateNewPlan}
                disabled={generating}
                className="btn-primary flex items-center gap-2 text-xs py-2.5 px-4"
              >
                {generating ? (
                  <>
                    <LuLoader className="animate-spin" size={14} />
                    <span>Creating Plan...</span>
                  </>
                ) : (
                  <>
                    <LuSparkles size={14} />
                    <span>Generate Revision Plan Now</span>
                  </>
                )}
              </button>
              <Link
                href={activeMaterialId && activeMaterialId !== 'all' ? `/quiz?materialId=${activeMaterialId}` : '/quiz'}
                className="btn-secondary text-xs py-2.5 px-4 flex items-center gap-1.5"
              >
                Take Diagnostic Quiz
              </Link>
              <Link href="/dashboard" className="btn-secondary text-xs py-2.5 px-4 flex items-center gap-1.5">
                Go to Dashboard
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
              {planItems.map((item, idx) => {
                const isHigh = item.priority === 'high'
                const isMedium = item.priority === 'medium'
                const activities = getSafeActivities(item)
                const resources = getSafeResources(item)

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
                          `Can you guide me through my revision for ${item.topic_name}? Focus on: ${activities.join(
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
                        {activities.map((act, aIdx) => (
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
                    {resources.length > 0 && (
                      <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-gray-400">
                        <span className="flex items-center gap-1 text-purple-300 font-semibold">
                          <LuBookOpen size={13} /> Targeted Sections:
                        </span>
                        {resources.map((res, rIdx) => (
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
