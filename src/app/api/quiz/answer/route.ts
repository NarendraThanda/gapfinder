import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { quizId, questionId, selectedAnswer, isCorrect, timeTaken } = await request.json()

    // Save answer
    const { error: answerError } = await supabase.from('quiz_answers').insert({
      quiz_id: quizId,
      question_id: questionId,
      user_id: user.id,
      selected_answer: selectedAnswer,
      is_correct: isCorrect,
      time_taken_seconds: timeTaken || 0,
    })

    if (answerError) {
      return NextResponse.json({ error: 'Failed to save answer' }, { status: 500 })
    }

    // Update quiz progress
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', quizId)
      .single()

    if (quiz) {
      const newAnswered = quiz.answered_questions + 1
      const newCorrect = quiz.correct_answers + (isCorrect ? 1 : 0)
      const isComplete = newAnswered >= quiz.total_questions

      await supabase
        .from('quizzes')
        .update({
          answered_questions: newAnswered,
          correct_answers: newCorrect,
          status: isComplete ? 'completed' : 'in_progress',
          completed_at: isComplete ? new Date().toISOString() : null,
        })
        .eq('id', quizId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Answer submission error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
