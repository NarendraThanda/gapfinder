'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import ReactMarkdown from 'react-markdown'
import {
  LuMessageCircle,
  LuSparkles,
  LuSend,
  LuQuote,
  LuLoader,
  LuBookOpen,
  LuInfo,
  LuUser,
} from 'react-icons/lu'

interface Citation {
  source: string
  content: string
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
}

const SUGGESTED_QUERIES = [
  'Derive the Effective Memory Access Time (EMAT) formula from my notes',
  'What are the 4 Coffman conditions for deadlock to occur?',
  'Explain Peter Denning\'s working set model and thrashing in demand paging',
  'How does the Banker\'s Algorithm determine if a state is safe?',
]

import MaterialContextSelector, { MaterialOption } from '@/components/MaterialContextSelector'

export default function AssistantPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-400">Loading AI Assistant...</div>}>
      <AssistantContent />
    </Suspense>
  )
}

function AssistantContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('query')
  const urlMaterialId = searchParams.get('materialId')

  const [materials, setMaterials] = useState<MaterialOption[]>([])
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(urlMaterialId)
  const [activeMaterialTitle, setActiveMaterialTitle] = useState<string | null>(null)

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Hello! I am your **GapFinder Grounded Assistant**. I answer questions strictly based on the study materials, lecture notes, and syllabus you have uploaded. Every explanation I provide will cite the exact section from your material.',
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function loadMaterials() {
      try {
        const storedId = typeof window !== 'undefined' ? localStorage.getItem('gapfinder_active_material_id') : null
        const res = await fetch('/api/materials')
        if (res.ok) {
          const data = await res.json()
          const list: MaterialOption[] = data.materials || []
          setMaterials(list)
          const resolved = urlMaterialId || storedId || (list.length > 0 ? list[0].id : null)
          setActiveMaterialId(resolved)
          if (resolved === 'all') {
            setActiveMaterialTitle('All Uploaded Materials')
          } else {
            const mat = list.find((m) => m.id === resolved)
            if (mat) setActiveMaterialTitle(mat.title)
          }

          if (initialQuery) {
            handleSendMessage(initialQuery, resolved)
          }
        } else if (initialQuery) {
          handleSendMessage(initialQuery)
        }
      } catch (err) {
        console.error('Error loading materials for assistant:', err)
        if (initialQuery) {
          handleSendMessage(initialQuery)
        }
      }
    }
    loadMaterials()
  }, [urlMaterialId])

  const handleMaterialChange = (matId: string) => {
    setActiveMaterialId(matId)
    if (typeof window !== 'undefined') {
      if (matId === 'all') {
        localStorage.setItem('gapfinder_active_material_id', 'all')
      } else {
        localStorage.setItem('gapfinder_active_material_id', matId)
      }
    }
    if (matId === 'all') {
      setActiveMaterialTitle('All Uploaded Materials')
    } else {
      const mat = materials.find((m) => m.id === matId)
      setActiveMaterialTitle(mat ? mat.title : null)
    }
  }

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSendMessage = async (textToSend?: string, matIdOverride?: string | null) => {
    const text = (textToSend || input).trim()
    if (!text || loading) return

    const matId = matIdOverride !== undefined ? matIdOverride : activeMaterialId

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const historyPayload = messages.map((m) => ({
        role: m.role,
        content: m.content,
      }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          chatHistory: historyPayload,
          materialId: matId,
        }),
      })

      if (res.status === 401) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: '⚠️ You are not signed in. Please sign in to consult your grounded study assistant.',
          },
        ])
        return
      }

      const data = await res.json()
      if (res.ok) {
        const assistantMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.answer || 'No answer generated.',
          citations: data.citations || [],
        }
        setMessages((prev) => [...prev, assistantMsg])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: 'assistant',
            content: `⚠️ ${data.error || 'Unable to retrieve answer from your study materials.'}`,
          },
        ])
      }
    } catch (err) {
      console.error('Chat error:', err)
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ Network error communicating with grounded assistant.',
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  return (
    <AppLayout
      headerTitle="Explain-This-Topic Assistant"
      headerSubtitle={
        activeMaterialTitle
          ? `Grounded Q&A answering strictly from: ${activeMaterialTitle}`
          : 'Grounded AI tutor answering strictly from your uploaded course notes with source citations'
      }
      actionButton={
        materials.length > 0 ? (
          <MaterialContextSelector
            materials={materials}
            activeMaterialId={activeMaterialId}
            onSelectMaterial={handleMaterialChange}
          />
        ) : undefined
      }
    >
      <div className="max-w-4xl mx-auto flex-1 flex flex-col h-[calc(100dvh-270px)] min-h-[380px]">
        {/* RAG Verification Disclaimer */}
        <div className="glass p-3 mb-4 rounded-xl flex items-center justify-between text-xs border-l-4 border-l-cyan-400">
          <div className="flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
            <LuInfo className="text-cyan-400 shrink-0" size={16} />
            <span>
              <strong>RAG Grounding Active:</strong> This model is constrained strictly to your indexed vector chunks. It cannot hallucinate facts outside your materials.
            </span>
          </div>
        </div>

        {/* Chat Messages Container */}
        <div className="glass flex-1 overflow-y-auto p-4 md:p-6 space-y-6 rounded-2xl mb-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-1"
                  style={{ background: 'var(--gradient-primary)' }}
                >
                  <LuSparkles size={16} className="text-white" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 md:p-5 space-y-3 ${
                  msg.role === 'user'
                    ? 'bg-purple-600/30 border border-purple-500/40 text-white ml-auto'
                    : 'bg-white/[0.03] border border-white/10 text-gray-200'
                }`}
              >
                <div className="markdown-content text-sm leading-relaxed">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>

                {/* Grounded Citations Box */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                      <LuQuote size={12} />
                      <span>Retrieved Material Citations ({msg.citations.length})</span>
                    </div>

                    <div className="space-y-1.5">
                      {msg.citations.map((cite, cIdx) => (
                        <div
                          key={cIdx}
                          className="p-2.5 rounded-lg bg-black/40 border border-white/5 text-xs text-gray-300 space-y-1"
                        >
                          <div className="font-semibold text-cyan-300 text-[11px] flex items-center gap-1">
                            <LuBookOpen size={12} />
                            <span>{cite.source}</span>
                          </div>
                          <p className="text-[11px] italic opacity-85">&quot;{cite.content}&quot;</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {msg.role === 'user' && (
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0 mt-1 text-purple-300">
                  <LuUser size={16} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 items-center text-xs text-purple-300 py-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--gradient-primary)' }}>
                <LuSparkles size={16} className="text-white animate-spin" />
              </div>
              <div className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center gap-2">
                <LuLoader className="animate-spin" size={14} />
                <span>Searching vector embeddings and synthesizing citation-backed explanation...</span>
              </div>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Suggested Queries Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-2 scrollbar-none">
          <span className="text-[11px] text-gray-400 shrink-0 font-semibold">Try:</span>
          {SUGGESTED_QUERIES.map((sq, idx) => (
            <button
              key={idx}
              onClick={() => handleSendMessage(sq)}
              className="text-[11px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:text-white hover:border-purple-400/50 whitespace-nowrap transition-colors shrink-0"
            >
              {sq}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSendMessage()
          }}
          className="relative flex items-center"
        >
          <input
            type="text"
            className="input-glass pl-4 pr-14 text-sm py-3.5"
            style={{ paddingRight: '3.5rem' }}
            placeholder="Ask anything about your syllabus, lecture notes, or past papers..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            id="chat-input"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="absolute right-3 p-2 rounded-xl bg-purple-600 text-white disabled:opacity-40 hover:bg-purple-500 transition-colors z-10"
            id="chat-send-btn"
            aria-label="Send message"
          >
            <LuSend size={16} />
          </button>
        </form>
      </div>
    </AppLayout>
  )
}
