'use client'

import { useState, useEffect } from 'react'
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
} from 'react-icons/lu'

interface MaterialItem {
  id: string
  title: string
  type: 'syllabus' | 'notes' | 'textbook' | 'question_paper'
  file_name: string
  status: 'processing' | 'ready' | 'error'
  created_at: string
}

export default function MaterialsPage() {
  const [materials, setMaterials] = useState<MaterialItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [title, setTitle] = useState('')
  const [docType, setDocType] = useState<'syllabus' | 'notes' | 'textbook' | 'question_paper'>('syllabus')
  const [rawText, setRawText] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  const [isError, setIsError] = useState(false)

  const fetchMaterials = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/materials')
      if (res.ok) {
        const data = await res.json()
        setMaterials(data.materials || [])
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
      setStatusMessage('Processing document, chunking content, and generating embeddings...')

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

      if (res.ok) {
        setStatusMessage('Material successfully uploaded! Content is indexed and ready.')
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
    if (!confirm('Are you sure you want to delete this study material and all its indexed chunks?')) return
    try {
      const res = await fetch('/api/materials', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setMaterials(materials.filter((m) => m.id !== id))
      }
    } catch (err) {
      console.error('Delete error:', err)
    }
  }

  const handleQuickSeed = async () => {
    setUploading(true)
    setStatusMessage('Seeding full CS301 syllabus, lecture notes & midterm papers...')
    try {
      const res = await fetch('/api/seed-demo', { method: 'POST' })
      if (res.ok) {
        setStatusMessage('Demo study materials and syllabus topics seeded!')
        await fetchMaterials()
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
          className="btn-secondary flex items-center gap-2 text-xs py-2 px-3"
        >
          <LuSparkles size={14} className="text-purple-400" />
          Preload Sample Course
        </button>
      }
    >
      <div className="grid lg:grid-cols-12 gap-8 pb-12">
        {/* Upload Form Card */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass p-6 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <LuUpload className="text-purple-400" />
                Upload New Material
              </h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                Upload syllabus to auto-extract topics, or notes/past papers for question grounding.
              </p>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Document Title
                </label>
                <input
                  type="text"
                  className="input-glass"
                  placeholder="e.g. Distributed Systems Course Syllabus"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Document Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'syllabus', label: 'Syllabus (Auto-Topic)', desc: 'Builds curriculum map' },
                    { id: 'notes', label: 'Lecture Notes', desc: 'Detailed concepts' },
                    { id: 'textbook', label: 'Textbook / Chapter', desc: 'In-depth reference' },
                    { id: 'question_paper', label: 'Past Questions', desc: 'Exam format' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setDocType(cat.id as any)}
                      className={`p-3 text-left rounded-xl border transition-all ${
                        docType === cat.id
                          ? 'border-purple-500 bg-purple-500/15 text-white shadow-lg shadow-purple-500/10'
                          : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20'
                      }`}
                    >
                      <div className="text-xs font-bold">{cat.label}</div>
                      <div className="text-[10px] opacity-70 mt-0.5">{cat.desc}</div>
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
                      PDF, text, or markdown files supported
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
                    Optional fallback
                  </span>
                </div>
                <textarea
                  className="input-glass text-xs h-28 resize-none font-mono"
                  placeholder="Paste syllabus modules, chapter notes, or past questions here..."
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                />
              </div>

              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    isError
                      ? 'bg-red-500/10 border border-red-500/30 text-red-400'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {isError ? <LuCircleHelp size={16} /> : <LuCircleCheck size={16} />}
                  <span>{statusMessage}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={uploading}
                className="btn-primary w-full flex items-center justify-center gap-2"
                id="submit-material-btn"
              >
                {uploading ? <LuLoader className="animate-spin" size={18} /> : <LuUpload size={18} />}
                <span>{uploading ? 'Processing & Embedding Material...' : 'Index & Process Material'}</span>
              </button>
            </form>
          </div>

          {/* RAG Pipeline Explanation Box */}
          <div className="glass p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
              <LuSparkles size={14} /> How RAG Grounds Your Learning
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              When you upload materials, GapFinder AI chunks text into 800-character segments with 200-character overlap. Each chunk is transformed into high-dimensional vector embeddings via Gemini.
              Diagnostic quizzes and AI answers search this vector space so every question has an exact citation back to your source material.
            </p>
          </div>
        </div>

        {/* Existing Materials List */}
        <div className="lg:col-span-6 space-y-6">
          <div className="glass p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">Indexed Materials</h2>
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {materials.length} documents ready for diagnosis & retrieval
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
                    Upload your syllabus or lecture notes, or click &quot;Preload Sample Course&quot; to test with pre-configured computer science materials.
                  </p>
                </div>
                <button onClick={handleQuickSeed} className="btn-secondary text-xs py-2 px-4">
                  Preload Sample Course
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {materials.map((mat) => (
                  <div
                    key={mat.id}
                    className="p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-white/5 mt-0.5 shrink-0">
                        {getTypeIcon(mat.type)}
                      </div>
                      <div className="min-w-0 space-y-1">
                        <h4 className="text-sm font-semibold text-white truncate">{mat.title}</h4>
                        <div className="flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          <span className="capitalize">{mat.type.replace('_', ' ')}</span>
                          <span>•</span>
                          <span>{mat.file_name}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${
                          mat.status === 'ready'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : mat.status === 'processing'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                        }`}
                      >
                        {mat.status}
                      </span>
                      <button
                        onClick={() => handleDelete(mat.id)}
                        className="text-gray-400 hover:text-red-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors"
                        title="Delete material"
                      >
                        <LuTrash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
