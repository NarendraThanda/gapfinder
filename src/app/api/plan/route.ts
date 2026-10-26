import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateRevisionPlan } from '@/lib/rag'

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { availableHours = 10 } = await request.json()

    // Get latest gap reports
    const { data: reports } = await supabase
      .from('gap_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (!reports || reports.length === 0) {
      return NextResponse.json({ error: 'No gap reports found. Take a quiz first.' }, { status: 400 })
    }

    // Get latest report per topic
    const latestPerTopic: Record<string, typeof reports[0]> = {}
    for (const report of reports) {
      if (!latestPerTopic[report.topic_id]) {
        latestPerTopic[report.topic_id] = report
      }
    }

    const gapData = Object.values(latestPerTopic).map(r => ({
      topic_name: r.topic_name,
      strength: r.strength as 'weak' | 'medium' | 'strong',
      score: r.score,
      reason: r.reason,
      suggestions: r.suggestions,
    }))

    const allTopics = Object.values(latestPerTopic).map(r => r.topic_name)

    // Generate plan with AI
    const planItems = await generateRevisionPlan(gapData, availableHours, allTopics)

    // Save plan
    const { data: plan, error } = await supabase
      .from('revision_plans')
      .insert({
        user_id: user.id,
        gap_report_ids: Object.values(latestPerTopic).map(r => r.id),
        title: `Revision Plan - ${new Date().toLocaleDateString()}`,
        available_hours: availableHours,
        plan_data: planItems,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to save plan' }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Plan generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: plans, error } = await supabase
      .from('revision_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plans })
  } catch (error) {
    console.error('Plans fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { planId, planData, status } = await request.json()

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (planData) updates.plan_data = planData
    if (status) updates.status = status

    const { data: plan, error } = await supabase
      .from('revision_plans')
      .update(updates)
      .eq('id', planId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (error) {
    console.error('Plan update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
