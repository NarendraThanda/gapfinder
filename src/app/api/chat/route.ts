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

    if (!message) {
      return NextResponse.json({ error: 'No message provided' }, { status: 400 })
    }

    // Retrieve relevant chunks via vector search scoped to selected material
    const embedding = await generateEmbedding(message)

    const rpcParams: any = {
      query_embedding: embedding,
      match_user_id: user.id,
      match_count: 8,
      match_threshold: 0.3,
    }
    if (materialId && materialId !== 'all') {
      rpcParams.match_material_id = materialId
    }

    const { data: chunks } = await supabase.rpc('match_chunks', rpcParams)

    const context = chunks?.map((c: { content: string }) => c.content).join('\n\n') || ''

    if (!context) {
      return NextResponse.json({
        answer: "I don't have enough study material to answer this question. Please upload your study materials first (syllabus, notes, or textbooks) so I can help you with topic-specific explanations.",
        citations: [],
      })
    }

    // Generate RAG response
    const response = await ragChat(message, context, chatHistory)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Chat error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
