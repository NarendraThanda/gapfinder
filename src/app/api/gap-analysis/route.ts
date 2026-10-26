import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { analyzeGaps } from '@/lib/rag'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quizId } = await request.json()

    // Fetch quiz data
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .eq('user_id', user.id)
      .single()

    if (!quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 })
    }

    // Fetch questions and answers
    const { data: questions } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quizId)

    const { data: answers } = await supabase
      .from('quiz_answers')
      .select('*')
      .eq('quiz_id', quizId)
      .eq('user_id', user.id)

    if (!questions || !answers) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 })
    }

    // Group results by topic
    const topicResults: Record<string, { topic_name: string; total: number; correct: number; questions: string[] }> = {}

    for (const question of questions) {
      const answer = answers.find(a => a.question_id === question.id)
      const topicId = question.topic_id || 'unknown'

      // Get topic name
      let topicName = 'General'
      if (question.topic_id) {
        const { data: topic } = await supabase
          .from('topics')
          .select('name')
          .eq('id', question.topic_id)
          .single()
        topicName = topic?.name || 'General'
      }

      if (!topicResults[topicId]) {
        topicResults[topicId] = { topic_name: topicName, total: 0, correct: 0, questions: [] }
      }

      topicResults[topicId].total++
      if (answer?.is_correct) {
        topicResults[topicId].correct++
      }
      topicResults[topicId].questions.push(
        `Q: ${question.question} | ${answer?.is_correct ? 'Correct' : 'Wrong'} | ${question.explanation}`
      )
    }

    // Run AI gap analysis
    const gapResults = await analyzeGaps(Object.values(topicResults))

    // Save gap reports and update topic strengths
    const savedReports = []
    for (const gap of gapResults) {
      const topicId = Object.keys(topicResults).find(
        id => topicResults[id].topic_name === gap.topic_name
      )

      if (topicId && topicId !== 'unknown') {
        // Save gap report
        const { data: report } = await supabase
          .from('gap_reports')
          .insert({
            user_id: user.id,
            quiz_id: quizId,
            topic_id: topicId,
            topic_name: gap.topic_name,
            strength: gap.strength,
            score: gap.score,
            total_questions: topicResults[topicId].total,
            correct_answers: topicResults[topicId].correct,
            reason: gap.reason,
            suggestions: gap.suggestions,
          })
          .select()
          .single()

        if (report) savedReports.push(report)

        // Update topic strength
        await supabase
          .from('topics')
          .update({ strength: gap.strength, score: gap.score })
          .eq('id', topicId)

        // Save progress history
        await supabase.from('progress_history').insert({
          user_id: user.id,
          topic_id: topicId,
          topic_name: gap.topic_name,
          score: gap.score,
          strength: gap.strength,
          quiz_id: quizId,
        })
      }
    }

    return NextResponse.json({ reports: savedReports })
  } catch (error) {
    console.error('Gap analysis error:', error)
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

    let query = supabase
      .from('gap_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (quizId) {
      query = query.eq('quiz_id', quizId)
    }

    const { data: reports, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ reports })
  } catch (error) {
    console.error('Gap reports fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
