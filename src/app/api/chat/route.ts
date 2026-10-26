import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { ragChat } from '@/lib/rag'
import { generateEmbedding } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, chatHistory = [], materialId } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    const trimmedMsg = message.trim()
    const isGreeting = /^(hi|hello|hey|greetings|who are you|what can you do|help)[!.,? ]*$/i.test(trimmedMsg)

    // Check user materials
    const { data: userMaterials } = await supabase
      .from('materials')
      .select('id, title, raw_text')
      .eq('user_id', user.id)

    if (!userMaterials || userMaterials.length === 0) {
      if (isGreeting) {
        return NextResponse.json({
          answer: "Hello! I am your **GapFinder AI Study Assistant**. Upload your syllabus or course material in the **Materials** section, and I will help answer your questions, explain complex topics, and diagnose your knowledge gaps with citations!",
          citations: []
        })
      }
      return NextResponse.json({
        answer: "You have not uploaded any study materials yet. Please upload your syllabus, lecture notes, or textbooks in the **Materials** section so I can provide accurate, cited explanations.",
        citations: [],
      })
    }

    const targetMaterials = (materialId && materialId !== 'all')
      ? userMaterials.filter(m => m.id === materialId)
      : userMaterials

    const activeTitles = targetMaterials.map(m => m.title).filter(Boolean)
    const titlesSummary = activeTitles.slice(0, 3).join(', ')

    if (isGreeting) {
      return NextResponse.json({
        answer: `Hello! I am your **GapFinder AI Grounded Tutor**. I am currently referencing: **${titlesSummary || 'your uploaded materials'}**.\n\nAsk me anything about your course topics, request a step-by-step formula derivation, or ask for quiz preparation!`,
        citations: []
      })
    }

    // Extract search tokens from user question (skipping common stopwords)
    const stopwords = new Set([
      'what', 'are', 'the', 'how', 'does', 'why', 'can', 'you', 'explain', 'tell', 'me', 'about',
      'is', 'a', 'an', 'in', 'on', 'of', 'for', 'to', 'from', 'with', 'and', 'or', 'my', 'notes',
      'material', 'materials', 'study', 'derive', 'formula', 'show', 'describe', 'give', 'please'
    ])
    const queryTokens = trimmedMsg
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length >= 3 && !stopwords.has(t))

    // Stage 1: Vector Search Attempt
    let vectorChunks: string[] = []
    try {
      const embedding = await generateEmbedding(trimmedMsg)
      const rpcParams: any = {
        query_embedding: embedding,
        match_user_id: user.id,
        match_count: 6,
        match_threshold: 0.20,
      }
      if (materialId && materialId !== 'all') {
        rpcParams.match_material_id = materialId
      }

      const { data: vData } = await supabase.rpc('match_chunks', rpcParams)
      if (Array.isArray(vData) && vData.length > 0) {
        vectorChunks = vData.map((c: any) => c.content).filter(Boolean)
      }
    } catch (vectorErr) {
      console.warn('Vector search skipped/failed in chat route:', vectorErr)
    }

    // Stage 2: Direct Chunk Query & Scoring from material_chunks
    let rankedChunkTexts: string[] = []
    try {
      let chunkQuery = supabase
        .from('material_chunks')
        .select('material_id, topic_hint, content')
        .eq('user_id', user.id)

      if (materialId && materialId !== 'all') {
        chunkQuery = chunkQuery.eq('material_id', materialId)
      }

      const { data: dbChunks } = await chunkQuery
      if (dbChunks && dbChunks.length > 0) {
        const titleMap = new Map(userMaterials.map(m => [m.id, m.title]))
        const seen = new Set<string>()

        const scored = dbChunks.map(c => {
          const content = c.content || ''
          const contentLow = content.toLowerCase()
          const topicLow = (c.topic_hint || '').toLowerCase()
          let score = 0

          if (contentLow.includes(trimmedMsg.toLowerCase())) score += 40

          for (let i = 0; i < queryTokens.length - 1; i++) {
            const pair = queryTokens[i] + ' ' + queryTokens[i + 1]
            if (contentLow.includes(pair)) score += 15
          }

          for (const tok of queryTokens) {
            if (contentLow.includes(tok)) score += 4
            if (topicLow.includes(tok)) score += 8
          }

          return {
            title: titleMap.get(c.material_id) || 'Course Material',
            topic: c.topic_hint || 'General',
            content,
            score,
          }
        })

        scored.sort((a, b) => b.score - a.score)
        const uniqueScored = scored.filter(s => {
          const norm = s.content.trim().slice(0, 100)
          if (seen.has(norm)) return false
          seen.add(norm)
          return s.score > 0
        })

        const topScored = uniqueScored.slice(0, 5)
        if (topScored.length > 0) {
          rankedChunkTexts = topScored.map(s => `=== SOURCE: ${s.title} (${s.topic}) ===\n${s.content}`)
        }
      }
    } catch (chunkErr) {
      console.warn('Direct chunk scoring error in chat route:', chunkErr)
    }

    // Stage 3: Paragraph Extraction from raw_text
    let fallbackParagraphs: string[] = []
    if (rankedChunkTexts.length === 0 && vectorChunks.length === 0) {
      for (const mat of targetMaterials) {
        const text: string = mat.raw_text || ''
        const paragraphs: string[] = text.split(/\n\s*\n/).map((p: string) => p.trim()).filter((p: string) => p.length > 30)

        const pScored: Array<{ text: string; score: number }> = paragraphs.map((p: string) => {
          const pLow = p.toLowerCase()
          let sc = 0
          for (const tok of queryTokens) {
            if (pLow.includes(tok)) sc += 3
          }
          return { text: p, score: sc }
        })

        pScored.sort((a: { text: string; score: number }, b: { text: string; score: number }) => b.score - a.score)
        const topP = pScored.filter((p: { text: string; score: number }) => p.score > 0).slice(0, 4)
        if (topP.length > 0) {
          for (const item of topP) {
            fallbackParagraphs.push(`=== SOURCE: ${mat.title} ===\n${item.text}`)
          }
        } else if (text.length > 0 && fallbackParagraphs.length === 0) {
          fallbackParagraphs.push(`=== SOURCE: ${mat.title} ===\n${text.slice(0, 3000)}`)
        }
      }
    }

    // Assemble Retrieved Context
    let context = ''
    if (rankedChunkTexts.length > 0 && vectorChunks.length > 0) {
      context = [...rankedChunkTexts.slice(0, 3), ...vectorChunks.slice(0, 2)].join('\n\n')
    } else if (rankedChunkTexts.length > 0) {
      context = rankedChunkTexts.join('\n\n')
    } else if (vectorChunks.length > 0) {
      context = vectorChunks.join('\n\n')
    } else {
      context = fallbackParagraphs.join('\n\n')
    }

    if (!context || context.trim().length === 0) {
      return NextResponse.json({
        answer: "I could not find relevant sections in your selected study materials for this topic. Try rephrasing your question or selecting **'All Materials'** in the context selector above.",
        citations: [],
      })
    }

    // Generate Grounded RAG Response
    const response = await ragChat(trimmedMsg, context, chatHistory, activeTitles)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
