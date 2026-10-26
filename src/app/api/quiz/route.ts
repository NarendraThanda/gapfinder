import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateQuestions } from '@/lib/rag'
import { generateEmbedding } from '@/lib/gemini'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topicIds, questionsPerTopic = 3, difficulty = 'mixed' } = await request.json()

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

    // Create quiz
    const totalQuestions = topics.length * questionsPerTopic
    const { data: quiz, error: quizError } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        title: `Diagnostic Quiz - ${new Date().toLocaleDateString()}`,
        topic_ids: topicIds,
        total_questions: totalQuestions,
        status: 'in_progress',
      })
      .select()
      .single()

    if (quizError) {
      return NextResponse.json({ error: 'Failed to create quiz' }, { status: 500 })
    }

    // Generate questions for each topic using RAG
    let questionIndex = 0
    for (const topic of topics) {
      // Retrieve relevant chunks via vector search
      const embedding = await generateEmbedding(topic.name + ' ' + (topic.description || ''))

      const { data: chunks } = await supabase.rpc('match_chunks', {
        query_embedding: embedding,
        match_user_id: user.id,
        match_count: 8,
        match_threshold: 0.3,
      })

      const context = chunks?.map((c: { content: string }) => c.content).join('\n\n') || ''

      if (!context) {
        continue
      }

      try {
        const questions = await generateQuestions(context, topic.name, questionsPerTopic, difficulty)

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

      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Update total questions count
    await supabase
      .from('quizzes')
      .update({ total_questions: questionIndex })
      .eq('id', quiz.id)

    // Fetch all questions
    const { data: allQuestions } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('order_index', { ascending: true })

    return NextResponse.json({ quiz: { ...quiz, total_questions: questionIndex }, questions: allQuestions })
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

      const { data: answers } = await supabase
        .from('quiz_answers')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('user_id', user.id)

      return NextResponse.json({ quiz, questions, answers })
    }

    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    return NextResponse.json({ quizzes })
  } catch (error) {
    console.error('Quiz fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
