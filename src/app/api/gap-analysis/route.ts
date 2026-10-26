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

    const body = await request.json().catch(() => ({}))
    let quizId = body.quizId
    const materialId = body.materialId

    // If quizId not provided directly, find the latest completed quiz for this material
    if (!quizId && materialId && materialId !== 'all') {
      const { data: latestQuiz } = await supabase
        .from('quizzes')
        .select('id')
        .eq('user_id', user.id)
        .eq('material_id', materialId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestQuiz) {
        quizId = latestQuiz.id
      }
    }

    if (!quizId) {
      return NextResponse.json({ error: 'Quiz ID or material with completed quiz required' }, { status: 400 })
    }

    // Fetch quiz data with material_id
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

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'No questions found for this quiz' }, { status: 404 })
    }

    // Group results by topic
    const topicResults: Record<string, { topic_name: string; total: number; correct: number; questions: string[] }> = {}
    const topicMaterialMap: Record<string, string | null> = {}

    for (const question of questions) {
      const answer = (answers || []).find(a => a.question_id === question.id)
      const topicId = question.topic_id || 'unknown'

      let topicName = 'General Concepts'
      if (question.topic_id) {
        const { data: topic } = await supabase
          .from('topics')
          .select('name, material_id')
          .eq('id', question.topic_id)
          .maybeSingle()
        if (topic?.name) topicName = topic.name
        if (topic?.material_id) topicMaterialMap[topicId] = topic.material_id
      }

      if (!topicResults[topicId]) {
        topicResults[topicId] = { topic_name: topicName, total: 0, correct: 0, questions: [] }
      }

      topicResults[topicId].total++
      if (answer?.is_correct) {
        topicResults[topicId].correct++
      }
      topicResults[topicId].questions.push(
        `Q: ${question.question} | ${answer?.is_correct ? 'Correct' : 'Incorrect'} | ${question.explanation || ''}`
      )
    }

    // Run AI gap analysis
    let gapResults: any[] = []
    try {
      gapResults = await analyzeGaps(Object.values(topicResults))
    } catch (aiErr) {
      console.warn('AI analyzeGaps call encountered error, using empirical fallbacks:', aiErr)
    }

    // Guarantee that every tested topic gets a gap report and updated strength
    const savedReports = []
    const resolvedMaterialId = quiz.material_id || materialId || null

    for (const [topicId, tData] of Object.entries(topicResults)) {
      if (topicId === 'unknown') continue

      // Match AI analysis by exact name, normalized lowercase, or inclusion
      const matchedGap = (gapResults || []).find(
        g => g.topic_name?.toLowerCase() === tData.topic_name.toLowerCase() ||
             g.topic_name?.toLowerCase().includes(tData.topic_name.toLowerCase()) ||
             tData.topic_name.toLowerCase().includes(g.topic_name?.toLowerCase())
      )

      const empiricalScore = tData.total > 0 ? Math.round((tData.correct / tData.total) * 100) : 0
      const score = typeof matchedGap?.score === 'number' ? Math.max(0, Math.min(100, matchedGap.score)) : empiricalScore
      const strength: 'weak' | 'medium' | 'strong' =
        matchedGap?.strength === 'weak' || matchedGap?.strength === 'medium' || matchedGap?.strength === 'strong'
          ? matchedGap.strength
          : score < 40 ? 'weak' : score < 70 ? 'medium' : 'strong'

      const reason = matchedGap?.reason || (
        strength === 'weak'
          ? `Diagnostic quiz performance revealed conceptual gaps in ${tData.topic_name} (${tData.correct}/${tData.total} questions correct, ${score}%). Review foundational principles.`
          : strength === 'medium'
          ? `Demonstrated partial conceptual understanding in ${tData.topic_name} (${tData.correct}/${tData.total} questions correct, ${score}%). Practice recommended.`
          : `Demonstrated strong conceptual grasp of ${tData.topic_name} with ${tData.correct}/${tData.total} questions correct (${score}%).`
      )

      const suggestions = (Array.isArray(matchedGap?.suggestions) && matchedGap.suggestions.length > 0)
        ? matchedGap.suggestions
        : [
            `Review lecture notes and definitions for ${tData.topic_name}.`,
            `Solve targeted practice questions focusing on ${tData.topic_name} edge cases.`,
          ]

      const finalMaterialId = resolvedMaterialId || topicMaterialMap[topicId] || null

      // Upsert/Insert gap report
      const { data: report, error: reportErr } = await supabase
        .from('gap_reports')
        .insert({
          user_id: user.id,
          quiz_id: quizId,
          topic_id: topicId,
          material_id: finalMaterialId,
          topic_name: tData.topic_name,
          strength,
          score,
          total_questions: tData.total,
          correct_answers: tData.correct,
          reason,
          suggestions,
        })
        .select()
        .single()

      if (report) {
        savedReports.push(report)
      } else if (reportErr) {
        console.error('Error saving gap report for topic', topicId, reportErr)
      }

      // Update topic strength and score in topics table
      await supabase
        .from('topics')
        .update({ strength, score })
        .eq('id', topicId)
        .eq('user_id', user.id)

      // Save progress history record
      await supabase.from('progress_history').insert({
        user_id: user.id,
        topic_id: topicId,
        topic_name: tData.topic_name,
        score,
        strength,
        quiz_id: quizId,
      })
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
    let materialId = searchParams.get('materialId')

    // Fetch user materials to validate and find active title
    const { data: materials } = await supabase
      .from('materials')
      .select('id, title, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // If quizId is provided, fetch specifically for that quiz
    if (quizId) {
      const { data: reports, error } = await supabase
        .from('gap_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('quiz_id', quizId)
        .order('created_at', { ascending: false })

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      const matchingMat = materials?.find(m => reports?.[0]?.material_id === m.id)
      return NextResponse.json({
        reports: reports || [],
        activeMaterialId: reports?.[0]?.material_id || null,
        activeMaterialTitle: matchingMat?.title || null,
      })
    }

    // Determine active material
    let activeMaterialId: string | null = null
    let activeMaterialTitle: string | null = null

    if (materialId === 'all') {
      activeMaterialId = 'all'
      activeMaterialTitle = 'All Materials'
    } else if (materialId && materials?.some(m => m.id === materialId)) {
      activeMaterialId = materialId
      activeMaterialTitle = materials.find(m => m.id === materialId)?.title || null
    } else if (materials && materials.length > 0) {
      activeMaterialId = materials[0].id
      activeMaterialTitle = materials[0].title
    }

    // Query gap reports
    let query = supabase
      .from('gap_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (activeMaterialId && activeMaterialId !== 'all') {
      query = query.eq('material_id', activeMaterialId)
    }

    let { data: reports, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-generate reports if user has completed quizzes for this material but no reports exist yet
    if ((!reports || reports.length === 0) && activeMaterialId && activeMaterialId !== 'all') {
      const { data: completedQuiz } = await supabase
        .from('quizzes')
        .select('id')
        .eq('user_id', user.id)
        .eq('material_id', activeMaterialId)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (completedQuiz) {
        // Find questions & answers to auto-populate reports
        const { data: qQuestions } = await supabase
          .from('quiz_questions')
          .select('*, topics(name)')
          .eq('quiz_id', completedQuiz.id)

        const { data: qAnswers } = await supabase
          .from('quiz_answers')
          .select('*')
          .eq('quiz_id', completedQuiz.id)
          .eq('user_id', user.id)

        if (qQuestions && qQuestions.length > 0) {
          const generatedReports = []
          const topicMap: Record<string, { name: string; total: number; correct: number }> = {}

          for (const q of qQuestions) {
            const ans = (qAnswers || []).find(a => a.question_id === q.id)
            const tId = q.topic_id || 'unknown'
            const tName = (q.topics as any)?.name || 'General Concepts'

            if (!topicMap[tId]) {
              topicMap[tId] = { name: tName, total: 0, correct: 0 }
            }
            topicMap[tId].total++
            if (ans?.is_correct) topicMap[tId].correct++
          }

          for (const [tId, tData] of Object.entries(topicMap)) {
            if (tId === 'unknown') continue
            const score = tData.total > 0 ? Math.round((tData.correct / tData.total) * 100) : 0
            const strength: 'weak' | 'medium' | 'strong' = score < 40 ? 'weak' : score < 70 ? 'medium' : 'strong'
            const reason = strength === 'weak'
              ? `Diagnostic assessment revealed knowledge gaps in ${tData.name} (${tData.correct}/${tData.total} correct, ${score}%).`
              : strength === 'medium'
              ? `Demonstrated moderate understanding of ${tData.name} (${tData.correct}/${tData.total} correct, ${score}%).`
              : `Demonstrated solid mastery of ${tData.name} (${tData.correct}/${tData.total} correct, ${score}%).`

            const { data: newReport } = await supabase
              .from('gap_reports')
              .insert({
                user_id: user.id,
                quiz_id: completedQuiz.id,
                topic_id: tId,
                material_id: activeMaterialId,
                topic_name: tData.name,
                strength,
                score,
                total_questions: tData.total,
                correct_answers: tData.correct,
                reason,
                suggestions: [
                  `Review key definitions and core mechanisms for ${tData.name}.`,
                  `Practice targeted questions focusing on ${tData.name}.`,
                ],
              })
              .select()
              .single()

            if (newReport) generatedReports.push(newReport)
          }

          if (generatedReports.length > 0) {
            reports = generatedReports
          }
        }
      }
    }

    return NextResponse.json({
      reports: reports || [],
      activeMaterialId,
      activeMaterialTitle,
    })
  } catch (error) {
    console.error('Gap reports fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
