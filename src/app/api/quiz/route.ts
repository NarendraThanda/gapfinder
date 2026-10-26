import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateQuestions, validateAndCleanQuestions } from '@/lib/rag'
import { generateEmbedding, cleanOptionText } from '@/lib/gemini'

export const maxDuration = 60

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      topicIds,
      materialId: requestedMaterialId,
      questionsPerTopic = 3,
      difficulty = 'mixed',
    } = await request.json()

    if (!topicIds || topicIds.length === 0) {
      return NextResponse.json({ error: 'No topics selected' }, { status: 400 })
    }

    // Fetch selected topics
    const { data: topics } = await supabase
      .from('topics')
      .select('*')
      .in('id', topicIds)

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: 'Topics not found' }, { status: 404 })
    }

    // Resolve material_id
    const resolvedMaterialId =
      requestedMaterialId ||
      topics.find((t) => t.material_id)?.material_id ||
      null

    // Create quiz linked to material
    const totalQuestions = topics.length * questionsPerTopic
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        material_id: resolvedMaterialId,
        title: `Diagnostic Quiz - ${new Date().toLocaleDateString()}`,
        topic_ids: topicIds,
        total_questions: totalQuestions,
        status: 'in_progress',
      })
      .select()
      .single()

    if (quizError) {
      console.error('Quiz creation DB error:', quizError)
      return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 })
    }

    // Generate questions for each topic using material-scoped RAG
    let questionIndex = 0
    for (const topic of topics) {
      const topicMaterial = topic.material_id || resolvedMaterialId

      // Retrieve relevant chunks via vector search restricted to this material
      const embedding = await generateEmbedding(topic.name + ' ' + (topic.description || ''))

      const rpcParams: any = {
        query_embedding: embedding,
        match_user_id: user.id,
        match_count: 8,
        match_threshold: 0.25,
      }
      if (topicMaterial) {
        rpcParams.match_material_id = topicMaterial
      }

      const { data: chunks } = await supabase.rpc('match_chunks', rpcParams)

      let context = chunks?.map((c: { content: string }) => c.content).join('\n\n') || ''

      // If no chunks matched or vector search was sparse, provide topic description context
      if (!context || context.trim().length < 15) {
        context = `Topic: ${topic.name}\nDescription: ${topic.description || 'Core concepts and techniques.'}\nKey study subject context.`
      }

      try {
        const rawQuestions = await generateQuestions(context, topic.name, questionsPerTopic, difficulty)
        const questions = validateAndCleanQuestions(rawQuestions, topic.name, questionsPerTopic, difficulty)

        for (const q of questions) {
          await supabase.from('quiz_questions').insert({
            quiz_id: quiz.id,
            topic_id: topic.id,
            question: q.question,
            options: q.options,
            correct_answer: q.correct_answer,
            explanation: q.explanation,
            citation: q.citation,
            difficulty: q.difficulty,
            order_index: questionIndex++,
          })
        }
      } catch (qError) {
        console.error(`Error generating questions for topic ${topic.name}:`, qError)
      }

      // Brief delay between topic chunks
      await new Promise(resolve => setTimeout(resolve, 200))
    }

    // Update total questions count
    await supabase
      .from('quizzes')
      .update({ total_questions: questionIndex })
      .eq('id', quiz.id)

    // Fetch all questions and defensively sanitize options
    const { data: allQuestions } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true })

    const sanitizedQuestions = (allQuestions || []).map((q: any) => ({
      ...q,
      options: Array.isArray(q.options)
        ? q.options.map((opt: any) => cleanOptionText(opt))
        : [],
    }))

    return NextResponse.json({
      quiz: { ...quiz, total_questions: questionIndex, material_id: resolvedMaterialId },
      questions: sanitizedQuestions,
    })
  } catch (error) {
    console.error('Quiz generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const quizId = searchParams.get('quizId')
    const materialId = searchParams.get('materialId')

    if (quizId) {
      const { data: quiz } = await supabase
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .eq('user_id', user.id)
        .single()

      const { data: questions } = await supabase
        .from('quiz_questions')
        .select('*')
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true })

      const sanitizedQuestions = (questions || []).map((q: any) => ({
        ...q,
        options: Array.isArray(q.options)
          ? q.options.map((opt: any) => cleanOptionText(opt))
          : [],
      }))

      const { data: answers } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('user_id', user.id)

      return NextResponse.json({ quiz, questions: sanitizedQuestions, answers: answers || [] })
    }

    let query = supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (materialId && materialId !== 'all') {
      query = query.eq('material_id', materialId)
    }

    const { data: quizzes, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ quizzes: quizzes || [] })
  } catch (error) {
    console.error('Quiz fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
