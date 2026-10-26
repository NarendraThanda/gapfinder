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
    let materialId = searchParams.get('materialId')

    // If materialId not specified, find the user's latest material
    if (!materialId) {
      const { data: latestMaterial } = await supabase
        .from('materials')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (latestMaterial) {
        materialId = latestMaterial.id
      }
    }

    let query = supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })

    if (materialId && materialId !== 'all') {
      // Validate that this material belongs to the user
      const { data: matCheck } = await supabase
        .from('materials')
        .select('id')
        .eq('id', materialId)
        .eq('user_id', user.id)
        .maybeSingle()

      if (!matCheck) {
        return NextResponse.json({ error: 'Material not found or access denied' }, { status: 404 })
      }

      query = query.eq('material_id', materialId)
    }

    const { data: topics, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Structure as parent-child tree
    const topLevelTopics = topics?.filter(t => !t.parent_topic_id) || []
    const topicTree = topLevelTopics.map(parent => ({
      ...parent,
      subtopics: topics?.filter(t => t.parent_topic_id === parent.id) || [],
    }))

    return NextResponse.json({
      topics: topicTree,
      materialId: materialId || null,
      totalTopics: topics?.length || 0,
    })
  } catch (error) {
    console.error('Topics fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
