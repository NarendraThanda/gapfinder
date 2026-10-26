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

    // Retrieve relevant chunks via vector search scoped to selected material
    let context = ''
    try {
      const embedding = await generateEmbedding(trimmedMsg)
      const rpcParams: any = {
        query_embedding: embedding,
        match_user_id: user.id,
        match_count: 8,
        match_threshold: 0.15,
      }
      if (materialId && materialId !== 'all') {
        rpcParams.match_material_id = materialId
      }

      const { data: chunks } = await supabase.rpc('match_chunks', rpcParams)
      if (chunks && chunks.length > 0) {
        context = chunks.map((c: { content: string }) => c.content).filter(Boolean).join('\n\n')
      }
    } catch (vectorErr) {
      console.warn('Vector search error in chat route, falling back to raw text:', vectorErr)
    }

    // Fallback: if vector search found nothing, extract from materials
    if (!context || context.length < 50) {
      const targetMaterials = (materialId && materialId !== 'all')
        ? userMaterials.filter(m => m.id === materialId)
        : userMaterials

      const combinedText = targetMaterials
        .map(m => m.raw_text || '')
        .filter(t => t.length > 0)
        .join('\n\n')

      if (combinedText.length > 0) {
        context = combinedText.slice(0, 3000)
      }
    }

    if (isGreeting) {
      const activeTitles = userMaterials.map(m => m.title).slice(0, 3).join(', ')
      return NextResponse.json({
        answer: "Hello! I am your **GapFinder AI Tutor**. I am grounded in your study material: **" + activeTitles + "**.\n\nAsk me anything about your curriculum, request an explanation of tricky topics, or ask for quiz practice!",
        citations: []
      })
    }

    if (!context) {
      return NextResponse.json({
        answer: "I could not find relevant content in your uploaded materials for this question. Try rephrasing or selecting 'All Materials' in the study context selector.",
        citations: [],
      })
    }

    // Generate RAG response
    const response = await ragChat(trimmedMsg, context, chatHistory)
    return NextResponse.json(response)
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
