import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get progress history
    const { data: history } = await supabase
      .from('progress_history')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true })

    // Get all topics with current strength
    const { data: topics } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .is('parent_topic_id', null)

    // Get quiz stats
    const { data: quizzes } = await supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Calculate summary stats
    const totalQuizzes = quizzes?.length || 0
    const completedQuizzes = quizzes?.filter(q => q.status === 'completed').length || 0
    const totalQuestions = quizzes?.reduce((sum, q) => sum + q.total_questions, 0) || 0
    const totalCorrect = quizzes?.reduce((sum, q) => sum + q.correct_answers, 0) || 0
    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

    const weakTopics = topics?.filter(t => t.strength === 'weak').length || 0
    const mediumTopics = topics?.filter(t => t.strength === 'medium').length || 0
    const strongTopics = topics?.filter(t => t.strength === 'strong').length || 0
    const untestedTopics = topics?.filter(t => t.strength === 'untested').length || 0

    return NextResponse.json({
      history,
      topics,
      quizzes,
      stats: {
        totalQuizzes,
        completedQuizzes,
        totalQuestions,
        totalCorrect,
        overallAccuracy,
        weakTopics,
        mediumTopics,
        strongTopics,
        untestedTopics,
      },
    })
  } catch (error) {
    console.error('Progress fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
