import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: topics, error } = await supabase
      .from('topics')
      .select('*')
      .eq('user_id', user.id)
      .order('order_index', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Structure as tree
    const topLevelTopics = topics?.filter(t => !t.parent_topic_id) || []
    const topicTree = topLevelTopics.map(parent => ({
      ...parent,
      subtopics: topics?.filter(t => t.parent_topic_id === parent.id) || [],
    }))

    return NextResponse.json({ topics: topicTree })
  } catch (error) {
    console.error('Topics fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
