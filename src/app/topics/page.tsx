'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import AppLayout from '@/components/AppLayout'
import {
  LuMap,
  LuChevronDown,
  LuChevronRight,
  LuBrain,
  LuFolderTree,
  LuCircleCheck,
  LuTriangleAlert,
  LuCircleHelp,
  LuSparkles,
  LuLoader,
} from 'react-icons/lu'

interface SubTopic {
  id: string
  name: string
  description: string | null
  strength: 'weak' | 'medium' | 'strong' | 'untested'
  score: number
}

interface ParentTopic {
  id: string
  name: string
  description: string | null
  strength: 'weak' | 'medium' | 'strong' | 'untested'
  score: number
  subtopics: SubTopic[]
}

import MaterialContextSelector, { MaterialOption } from '@/components/MaterialContextSelector'

export default function TopicMapPage() {
  const [topics, setTopics] = useState<ParentTopic[]>([])
  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null)
  const [activeMaterialTitle, setActiveMaterialTitle] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [expandedTopics, setExpandedTopics] = useState<Record<string, boolean>>({})

  const fetchTopicsAndMaterials = async (targetId?: string | null) => {
    try {
      setLoading(true)
      const storedId = typeof window !== 'undefined' ? localStorage.getItem('gapfinder_active_material_id') : null
      const effectiveId = targetId !== undefined ? targetId : (activeMaterialId || storedId)

      // Fetch materials list first or concurrently
      const [matRes, topicsRes] = await Promise.all([
        fetch('/api/materials'),
        fetch(`/api/topics${effectiveId ? `?materialId=${encodeURIComponent(effectiveId)}` : ''}`),
      ])

      let matList: MaterialOption[] = []
      if (matRes.ok) {
        const matData = await matRes.json()
        matList = matData.materials || []
        setMaterials(matList)
      }

      if (topicsRes.ok) {
        const data = await topicsRes.json()
        setTopics(data.topics || [])
        const currentMatId = data.activeMaterialId || effectiveId || (matList.length > 0 ? matList[0].id : null)
        setActiveMaterialId(currentMatId)
        if (currentMatId && typeof window !== 'undefined') {
          localStorage.setItem('gapfinder_active_material_id', currentMatId)
        }
        const currentMat = matList.find((m) => m.id === currentMatId)
        if (currentMat) {
          setActiveMaterialTitle(currentMat.title)
        }

        const initialExpanded: Record<string, boolean> = {}
        data.topics?.forEach((t: ParentTopic) => {
          initialExpanded[t.id] = true
        })
        setExpandedTopics(initialExpanded)
      }
    } catch (err) {
      console.error('Error fetching topics:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const urlMatId = params.get('materialId')
    fetchTopicsAndMaterials(urlMatId)
  }, [])

  const handleMaterialChange = (matId: string) => {
    // Clear previous material's topics immediately to prevent cross-material topic leaks
    setTopics([])
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
    fetchTopicsAndMaterials(matId)
  }

  const toggleExpand = (id: string) => {
    setExpandedTopics((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const getStrengthBadge = (strength: string, score: number) => {
    switch (strength) {
      case 'strong':
        return (
          <span className="badge badge-strong flex items-center gap-1">
            <LuCircleCheck size={12} />
            <span>Mastered ({score}%)</span>
          </span>
        )
      case 'medium':
        return (
          <span className="badge badge-medium flex items-center gap-1">
            <LuTriangleAlert size={12} />
            <span>Review ({score}%)</span>
          </span>
        )
      case 'weak':
        return (
          <span className="badge badge-weak flex items-center gap-1">
            <LuTriangleAlert size={12} />
            <span>Gap Identified ({score}%)</span>
          </span>
        )
      default:
        return (
          <span className="badge bg-slate-500/10 text-slate-400 border border-slate-500/30 flex items-center gap-1">
            <LuCircleHelp size={12} />
            <span>Untested</span>
          </span>
        )
    }
  }

  return (
    <AppLayout
      headerTitle="Syllabus & Topic Map"
      headerSubtitle={
        activeMaterialTitle
          ? `Curriculum breakdown for: ${activeMaterialTitle}`
          : 'Hierarchical breakdown of your curriculum with real-time diagnostic health'
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
            className="btn-primary flex items-center gap-2 text-xs py-2 px-3"
          >
            <LuBrain size={16} />
            <span>Launch Diagnostic Quiz</span>
          </Link>
        </div>
      }
    >
      <div className="space-y-6 pb-12">
        {/* Explanatory summary header card */}
        <div className="glass p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <LuFolderTree className="text-purple-400" />
              Curriculum Knowledge Tree
            </h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Extracted automatically from your uploaded syllabus using Gemini 2.0. Status colors reflect your diagnostic quiz results.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="badge badge-weak">Gap (&lt;40%)</span>
            <span className="badge badge-medium">Review (40-70%)</span>
            <span className="badge badge-strong">Mastered (&gt;70%)</span>
          </div>
        </div>

        {/* Topic Tree View */}
        {loading ? (
          <div className="glass p-12 text-center text-sm text-gray-400 flex items-center justify-center gap-3">
            <LuLoader className="animate-spin" size={24} />
            <span>Analyzing syllabus and mapping topic nodes...</span>
          </div>
        ) : topics.length === 0 ? (
          <div className="glass p-12 text-center space-y-4">
            <LuMap className="mx-auto text-gray-500" size={48} />
            <div>
              <h3 className="text-base font-bold text-white">No Topics Extracted Yet</h3>
              <p className="text-xs mt-1 max-w-md mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Please upload a Syllabus document in the Materials section, or preload the sample course from the Dashboard to see an interactive topic map.
              </p>
            </div>
            <div className="flex justify-center gap-3">
              <Link href="/materials" className="btn-primary text-xs py-2 px-4">
                Upload Syllabus
              </Link>
              <Link href="/dashboard" className="btn-secondary text-xs py-2 px-4">
                Back to Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {topics.map((topic, index) => {
              const isExpanded = !!expandedTopics[topic.id]
              return (
                <div key={topic.id} className="glass overflow-hidden border border-white/10 transition-all">
                  {/* Parent Module Bar */}
                  <div
                    onClick={() => toggleExpand(topic.id)}
                    className="p-5 flex items-center justify-between gap-4 cursor-pointer hover:bg-white/[0.03] transition-colors select-none"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <button className="text-gray-400 hover:text-white transition-colors">
                        {isExpanded ? <LuChevronDown size={20} /> : <LuChevronRight size={20} />}
                      </button>

                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-purple-500/10 text-purple-300 border border-purple-500/20 shrink-0">
                        {index + 1}
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-base font-bold text-white truncate">{topic.name}</h3>
                        {topic.description && (
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                            {topic.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      {getStrengthBadge(topic.strength, topic.score)}
                      <Link
                        href={`/quiz?topicId=${topic.id}${activeMaterialId ? `&materialId=${encodeURIComponent(activeMaterialId)}` : ''}`}
                        onClick={(e) => e.stopPropagation()}
                        className="btn-secondary hidden sm:flex items-center gap-1.5 text-xs py-1.5 px-3"
                      >
                        <LuBrain size={14} />
                        <span>Test Topic</span>
                      </Link>
                    </div>
                  </div>

                  {/* Subtopics Expansion */}
                  {isExpanded && topic.subtopics && topic.subtopics.length > 0 && (
                    <div className="border-t border-white/5 bg-black/20 p-4 space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-purple-300 px-3 mb-2 flex items-center gap-1">
                        <LuSparkles size={12} />
                        <span>Granular Subtopics ({topic.subtopics.length})</span>
                      </div>

                      {topic.subtopics.map((sub, sIdx) => (
                        <div
                          key={sub.id}
                          className="p-3 rounded-lg border border-white/5 bg-white/[0.01] hover:bg-white/[0.03] flex items-center justify-between gap-4 ml-6 transition-colors"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="text-xs font-semibold text-gray-200 flex items-center gap-2">
                              <span className="text-purple-400 font-mono text-[10px]">
                                {index + 1}.{sIdx + 1}
                              </span>
                              <span>{sub.name}</span>
                            </div>
                            {sub.description && (
                              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {sub.description}
                              </p>
                            )}
                          </div>

                          <div className="shrink-0">
                            {getStrengthBadge(sub.strength, sub.score)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AppLayout>
  )
}
