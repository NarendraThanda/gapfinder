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
    const requestedMaterialId = searchParams.get('materialId')

    // 1. Fetch user profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    const userProfile = {
      id: user.id,
      email: user.email,
      full_name: profile?.full_name || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Student',
      avatar_url: profile?.avatar_url || user.user_metadata?.avatar_url || null,
    }

    // 2. Fetch all materials belonging to the user for the selector
    const { data: materials } = await supabase
      .from('materials')
      .select('id, title, type, status, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // 3. Determine active material safely (validate requestedMaterialId against actual user materials)
    let activeMaterialId: string | null = null
    let activeMaterialTitle: string | null = null

    if (requestedMaterialId === 'all') {
      activeMaterialId = 'all'
      activeMaterialTitle = 'All Materials'
    } else if (requestedMaterialId && materials?.some((m) => m.id === requestedMaterialId)) {
      activeMaterialId = requestedMaterialId
      activeMaterialTitle = materials.find((m) => m.id === requestedMaterialId)?.title || null
    } else if (materials && materials.length > 0) {
      activeMaterialId = materials[0].id
      activeMaterialTitle = materials[0].title
    }

    // 4. Get topics (scoped to activeMaterialId)
    let topicsQuery = supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .is('parent_topic_id', null)
      .order('order_index', { ascending: true })

    if (activeMaterialId && activeMaterialId !== 'all') {
      topicsQuery = topicsQuery.eq('material_id', activeMaterialId)
    }

    const { data: rawTopics } = await topicsQuery
    const topicIds = (rawTopics || []).map((t) => t.id)

    // 5. Get quizzes (scoped to activeMaterialId)
    let quizzesQuery = supabase
      .from('quizzes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (activeMaterialId && activeMaterialId !== 'all') {
      quizzesQuery = quizzesQuery.eq('material_id', activeMaterialId)
    }

    const { data: quizzes } = await quizzesQuery

    // 6. Get gap reports (scoped to activeMaterialId)
    let gapReportsQuery = supabase
      .from('gap_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(15)

    if (activeMaterialId && activeMaterialId !== 'all') {
      gapReportsQuery = gapReportsQuery.eq('material_id', activeMaterialId)
    }

    const { data: gapReports } = await gapReportsQuery

    // 7. Get revision plans (scoped to activeMaterialId)
    let plansQuery = supabase
      .from('revision_plans')
      .select('id, material_id, available_hours, status, plan_data, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(5)

    if (activeMaterialId && activeMaterialId !== 'all') {
      plansQuery = plansQuery.eq('material_id', activeMaterialId)
    }

    const { data: revisionPlans } = await plansQuery

    // 8. Enrich topics with gap report findings if topic is still marked 'untested'
    const topics = (rawTopics || []).map((t) => {
      if (t.strength && t.strength !== 'untested') return t
      const matchingReport = (gapReports || []).find(
        (r) => r.topic_id === t.id || r.topic_name.toLowerCase() === t.name.toLowerCase()
      )
      if (matchingReport) {
        return {
          ...t,
          strength: matchingReport.strength,
          score: matchingReport.score,
        }
      }
      return t
    })

    // 9. Get progress history (scoped to topics in this material)
    let historyQuery = supabase
      .from('progress_history')
      .select('*')
      .eq('user_id', user.id)
      .order('recorded_at', { ascending: true })

    if (activeMaterialId && activeMaterialId !== 'all' && topicIds.length > 0) {
      historyQuery = historyQuery.in('topic_id', topicIds)
    } else if (activeMaterialId && activeMaterialId !== 'all' && topicIds.length === 0) {
      historyQuery = historyQuery.eq('topic_id', '00000000-0000-0000-0000-000000000000')
    }

    const { data: history } = await historyQuery

    // 10. Calculate scoped summary stats
    const totalQuizzes = quizzes?.length || 0
    const completedQuizzesList = quizzes?.filter((q) => q.status === 'completed') || []
    const completedQuizzes = completedQuizzesList.length
    const totalQuestions = completedQuizzesList.reduce((sum, q) => sum + (q.total_questions || 0), 0)
    const totalCorrect = completedQuizzesList.reduce((sum, q) => sum + (q.correct_answers || 0), 0)

    let overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0
    if (overallAccuracy === 0 && gapReports && gapReports.length > 0) {
      const reportScores = gapReports.map((r) => r.score || 0)
      overallAccuracy = Math.round(reportScores.reduce((a, b) => a + b, 0) / reportScores.length)
    }

    const weakTopics = topics.filter((t) => t.strength === 'weak').length
    const mediumTopics = topics.filter((t) => t.strength === 'medium').length
    const strongTopics = topics.filter((t) => t.strength === 'strong').length
    const untestedTopics = topics.filter((t) => !t.strength || t.strength === 'untested').length

    return NextResponse.json({
      profile: userProfile,
      history: history || [],
      topics,
      quizzes: quizzes || [],
      materials: materials || [],
      recentGapReports: gapReports || [],
      recentPlans: revisionPlans || [],
      activeMaterialId,
      activeMaterialTitle,
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
