'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import {
  LuUpload,
  LuFileText,
  LuBookOpen,
  LuCircleHelp,
  LuTrash2,
  LuCircleCheck,
  LuSparkles,
  LuLoader,
  LuLayers,
  LuArrowRight,
  LuBrain,
  LuCheck,
} from 'react-icons/lu'

interface MaterialItem {
  id: string
  title: string
  type: 'syllabus' | 'notes' | 'textbook' | 'question_paper'
  file_name: string
  status: 'processing' | 'ready' | 'failed'
  error_message?: string | null
  created_at: string
}

export default function MaterialsPage() {
  const router = useRouter()
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState<'syllabus' | 'notes' | 'textbook' | 'question_paper'>('syllabus')
  const [rawText, setRawText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isError, setIsError] = useState(false)
  const [newlyUploadedMaterial, setNewlyUploadedMaterial] = useState<MaterialItem | null>(null)

  const fetchMaterials = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/materials')
      if (res.ok) {
        const data = await res.json()
        const mats: MaterialItem[] = data.materials || []
        setMaterials(mats)

        const storedId = typeof window !== 'undefined' ? localStorage.getItem('gapfinder_active_material_id') : null
        if (storedId && mats.some((m) => m.id === storedId)) {
          setActiveMaterialId(storedId)
        } else if (mats.length > 0) {
          setActiveMaterialId(mats[0].id)
          if (typeof window !== 'undefined') {
            localStorage.setItem('gapfinder_active_material_id', mats[0].id)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching materials:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMaterials()
  }, [])

  const handleSelectActive = (matId: string) => {
    setActiveMaterialId(matId)
    if (typeof window !== 'undefined') {
      localStorage.setItem('gapfinder_active_material_id', matId)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setIsError(true)
      setStatusMessage('Please enter a title for this material.')
      return
    }
    if (!selectedFile && !rawText.trim()) {
      setIsError(true)
      setStatusMessage('Please choose a file or paste document content.')
      return
    }

    if (selectedFile && selectedFile.size > 4.5 * 1024 * 1024) {
      setIsError(true)
      setStatusMessage('Selected file exceeds the 4.5MB limit. Please paste the syllabus or notes text directly in the box below.')
      return
    }

    try {
      setUploading(true)
      setIsError(false)
      setNewlyUploadedMaterial(null)
      setStatusMessage('Processing document: parsing text, chunking, and extracting curriculum topics...')

      const formData = new FormData()
      formData.append('title', title.trim())
      formData.append('type', docType)
      if (selectedFile) {
        formData.append('file', selectedFile)
      }
      if (rawText.trim()) {
        formData.append('rawText', rawText.trim())
      }

      const res = await fetch('/api/materials', {
        method: 'POST',
        body: formData,
      })

      const contentType = res.headers.get('content-type') || ''
      let data: any = {}

      if (contentType.includes('application/json')) {
        data = await res.json()
      } else {
        const raw = await res.text().catch(() => '')
        data = { error: raw.slice(0, 150) || `Server error (${res.status})` }
      }

      if (res.ok && data.material) {
        const mat = data.material
        handleSelectActive(mat.id)
        setNewlyUploadedMaterial(mat)

        setStatusMessage(
          `"${mat.title}" successfully indexed! Extracted ${data.topicsCount || 0} topics and ${data.chunksCount || 0} vector chunks.`
        )
        setTitle('')
        setRawText('')
        setSelectedFile(null)
        await fetchMaterials()
      } else {
        setIsError(true)
        setStatusMessage(data.error || 'Failed to upload material.')
      }
    } catch (err: any) {
      console.error('Material upload exception:', err)
      setIsError(true)
      setStatusMessage(
        err?.message && !err.message.includes('fetch')
          ? `Upload failed: ${err.message}`
          : 'Upload request interrupted. If uploading a large PDF, please paste the syllabus/notes text directly in the box.'
      )
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this study material and all its topics, quizzes, and chunks?')) return
    try {
      const res = await fetch('/api/materials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        const remaining = materials.filter((m) => m.id !== id)
        setMaterials(remaining)
        if (activeMaterialId === id) {
          const nextId = remaining.length > 0 ? remaining[0].id : null
          setActiveMaterialId(nextId)
          if (typeof window !== 'undefined') {
            if (nextId) localStorage.setItem('gapfinder_active_material_id', nextId)
            else localStorage.removeItem('gapfinder_active_material_id')
          }
        }
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleQuickSeed = async () => {
    setUploading(true)
    setIsError(false)
    setStatusMessage('Preloading sample Operating Systems course, syllabus, and midterm questions...')
    try {
      const res = await fetch('/api/seed-demo', { method: 'POST' })
      if (res.ok) {
        setStatusMessage('Demo study materials and syllabus topics seeded!')
        await fetchMaterials()
      } else {
        setIsError(true)
        setStatusMessage('Failed to seed materials.')
      }
    } catch {
      setIsError(true)
      setStatusMessage('Failed to seed materials.')
    } finally {
      setUploading(false)
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'syllabus':
        return <LuLayers className="text-purple-400" size={18} />
      case 'notes':
        return <LuFileText className="text-cyan-400" size={18} />
      case 'textbook':
        return <LuBookOpen className="text-emerald-400" size={18} />
      case 'question_paper':
        return <LuCircleHelp className="text-amber-400" size={18} />
      default:
        return <LuFileText size={18} />
    }
  }

  return (
    <AppLayout
      headerTitle="Study Materials & Syllabus"
      headerSubtitle="Upload your course material to power AI topic extraction and citation-backed diagnostic quizzes"
      actionButton={
        <button
          onClick={handleQuickSeed}
          disabled={uploading}
          className="btn-secondary flex items-center gap-2 text-xs md:text-sm py-2 px-3"
          id="preload-demo-materials-btn"
        >
          <LuSparkles size={16} className="text-purple-400" />
          <span>⚡ Preload Sample Course</span>
        </button>
      }
    >
      <div className="grid lg:grid-cols-12 gap-8 pb-12">
        {/* Upload Form Box */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass p-6 md:p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <LuUpload className="text-purple-400" />
                Upload New Study Material
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Each material is isolated into its own curriculum space with dedicated topics, quizzes, and gap reports.
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Material Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. CS301: Operating Systems, or Python 101, or SQL Mastery"
                  className="input-glass"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  id="material-title-input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Document Type
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['syllabus', 'notes', 'textbook', 'question_paper'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDocType(t)}
                      className={`p-2.5 rounded-xl border text-xs font-medium capitalize flex flex-col items-center justify-center gap-1 transition-all ${
                        docType === t
                          ? 'border-purple-500 bg-purple-500/20 text-white font-bold'
                          : 'border-white/5 bg-white/[0.02] text-gray-400 hover:text-white'
                      }`}
                    >
                      {getTypeIcon(t)}
                      <span>{t.replace('_', ' ')}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Attach Document File (PDF / TXT / MD)
                </label>
                <div className="border border-dashed border-white/20 rounded-xl p-6 text-center hover:border-purple-400/50 transition-colors bg-white/[0.01]">
                  <input
                    type="file"
                    id="file-upload-input"
                    className="hidden"
                    accept=".pdf,.txt,.md,.text"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="file-upload-input" className="cursor-pointer block space-y-2">
                    <LuUpload className="mx-auto text-purple-400" size={28} />
                    <div className="text-sm font-medium text-white">
                      {selectedFile ? selectedFile.name : 'Click to select or drag document'}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      PDF, text, or markdown files supported (Max 4.5MB)
                    </div>
                  </label>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                    Or Paste Text Direct
                  </label>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    Optional direct input
                  </span>
                </div>
                <textarea
                  className="input-glass text-xs h-28 resize-none font-mono"
                  placeholder="Paste syllabus modules, lecture notes, or key topic outlines directly..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>

              {statusMessage && (
                <div
                  className={`p-4 rounded-xl text-xs space-y-3 ${
                    isError
                      ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  <div className="flex items-center gap-2 font-medium">
                    {isError ? <LuCircleHelp size={16} /> : <LuCircleCheck size={16} />}
                    <span>{statusMessage}</span>
                  </div>

                  {newlyUploadedMaterial && !isError && (
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-500/20">
                      <Link
                        href={`/quiz?materialId=${newlyUploadedMaterial.id}`}
                        className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <LuBrain size={14} />
                        <span>Take Diagnostic Quiz</span>
                      </Link>
                      <Link
                        href={`/topics?materialId=${newlyUploadedMaterial.id}`}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <LuLayers size={14} />
                        <span>View Topics</span>
                      </Link>
                      <Link
                        href={`/dashboard?materialId=${newlyUploadedMaterial.id}`}
                        className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5"
                      >
                        <span>Open Dashboard</span>
                        <LuArrowRight size={14} />
                      </Link>
                    </div>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="btn-primary w-full flex items-center justify-center gap-2"
                id="submit-material-btn"
              >
                {uploading ? <LuLoader className="animate-spin" size={18} /> : <LuUpload size={18} />}
                <span>{uploading ? 'Processing & Indexing Material...' : 'Index & Process Material'}</span>
              </button>
            </form>
          </div>

          {/* RAG Pipeline Explanation Box */}
          <div className="glass p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <LuSparkles size={14} /> Isolated AI Pipeline Per Material
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Each upload creates isolated vector embeddings and a custom topic breakdown. Quizzes, gap diagnoses, and study plans are strictly partitioned so you never see old subject results when studying a new course.
            </p>
          </div>
        </div>

        {/* Existing Materials List */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Your Study Materials</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {materials.length} courses / documents registered in your account
                </p>
              </div>
              <button
                onClick={fetchMaterials}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 transition-colors"
                title="Refresh list"
              >
                <LuFileText size={16} />
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-gray-400 gap-2">
                <LuLoader className="animate-spin" size={20} />
                <span>Loading materials...</span>
              </div>
            ) : materials.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <LuBookOpen className="mx-auto text-gray-500" size={40} />
                <div>
                  <h3 className="text-sm font-semibold text-white">No Materials Uploaded Yet</h3>
                  <p className="text-xs mt-1 max-w-xs mx-auto" style={{ color: 'var(--text-muted)' }}>
                    Upload your syllabus or notes, or click &quot;Preload Sample Course&quot; to test with pre-configured computer science materials.
                  </p>
                </div>
                <button onClick={handleQuickSeed} className="btn-secondary text-xs py-2 px-4">
                  Preload Sample Course
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((mat) => {
                  const isActive = activeMaterialId === mat.id

                  return (
                    <div
                      key={mat.id}
                      className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                        isActive
                          ? 'border-purple-500/50 bg-purple-500/[0.05] shadow-lg shadow-purple-500/5'
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="p-2.5 rounded-lg bg-white/5 mt-0.5 shrink-0">
                          {getTypeIcon(mat.type)}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-white truncate">{mat.title}</h4>
                            {isActive && (
                              <span className="badge badge-strong text-[10px] flex items-center gap-1">
                                <LuCheck size={10} /> Active
                              </span>
                            )}
                            <span
                              className={`text-[10px] px-2 py-0.5 rounded-full capitalize font-semibold ${
                                mat.status === 'ready'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : mat.status === 'processing'
                                  ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {mat.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            <span className="capitalize">{mat.type.replace('_', ' ')}</span>
                            <span>•</span>
                            <span className="truncate max-w-[160px]">{mat.file_name}</span>
                          </div>

                          {mat.error_message && (
                            <p className="text-[11px] text-red-400">{mat.error_message}</p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <button
                          onClick={() => {
                            handleSelectActive(mat.id)
                            router.push(`/dashboard?materialId=${mat.id}`)
                          }}
                          className={`text-xs py-1.5 px-3 rounded-lg font-semibold transition-all ${
                            isActive
                              ? 'btn-primary text-xs py-1.5 px-3'
                              : 'btn-secondary text-xs py-1.5 px-3'
                          }`}
                        >
                          {isActive ? 'Study Now' : 'Select'}
                        </button>

                        <button
                          onClick={() => handleDelete(mat.id)}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                          title="Delete material"
                        >
                          <LuTrash2 size={16} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
