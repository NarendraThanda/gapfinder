import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    let requestedMaterialId = searchParams.get('materialId')

    // Fetch all materials belonging to the user for the selector
    const { data: materials } = await supabase
      .from('materials')
      .select('id, title, type, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Determine active material
    let activeMaterialId: string | null = null
    if (requestedMaterialId === 'all') {
      activeMaterialId = 'all'
    } else if (requestedMaterialId) {
      activeMaterialId = requestedMaterialId
    } else if (materials && materials.length > 0) {
      activeMaterialId = materials[0].id
    }

    // 1. Get topics (scoped to activeMaterialId)
    let topicsQuery = supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .is('parent_topic_id', null)
      .order('order_index', { ascending: true })

    if (activeMaterialId && activeMaterialId !== 'all') {
      topicsQuery = topicsQuery.eq('material_id', activeMaterialId)
    }

    const { data: topics } = await topicsQuery
    const topicIds = (topics || []).map((t) => t.id)

    // 2. Get quizzes (scoped to activeMaterialId)
    let quizzesQuery = supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (activeMaterialId && activeMaterialId !== 'all') {
      quizzesQuery = quizzesQuery.eq('material_id', activeMaterialId)
    }

    const { data: quizzes } = await quizzesQuery

    // 3. Get progress history (scoped to topics in this material)
    let historyQuery = supabase
      .from('progress_history')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true })

    if (activeMaterialId && activeMaterialId !== 'all' && topicIds.length > 0) {
      historyQuery = historyQuery.in('topic_id', topicIds)
    } else if (activeMaterialId && activeMaterialId !== 'all' && topicIds.length === 0) {
      // No topics for this material yet -> empty history
      historyQuery = historyQuery.eq('topic_id', '00000000-0000-0000-0000-000000000000')
    }

    const { data: history } = await historyQuery

    // Calculate scoped summary stats
    const totalQuizzes = quizzes?.length || 0
    const completedQuizzes = quizzes?.filter((q) => q.status === 'completed').length || 0
    const totalQuestions = quizzes?.reduce((sum, q) => sum + q.total_questions, 0) || 0
    const totalCorrect = quizzes?.reduce((sum, q) => sum + q.correct_answers, 0) || 0
    const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0

    const weakTopics = topics?.filter((t) => t.strength === 'weak').length || 0
    const mediumTopics = topics?.filter((t) => t.strength === 'medium').length || 0
    const strongTopics = topics?.filter((t) => t.strength === 'strong').length || 0
    const untestedTopics = topics?.filter((t) => t.strength === 'untested').length || 0

    return NextResponse.json({
      history: history || [],
      topics: topics || [],
      quizzes: quizzes || [],
      materials: materials || [],
      activeMaterialId,
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
