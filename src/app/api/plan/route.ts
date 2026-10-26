import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { generateRevisionPlan } from '@/lib/rag'
import { PRELOADED_TOPICS } from '@/lib/sampleData'

export const maxDuration = 60

interface NormalizedPlanItem {
  topic_name: string
  priority: 'high' | 'medium' | 'low'
  estimated_hours: number
  activities: string[]
  resources: string[]
  completed: boolean
  strength: 'weak' | 'medium' | 'strong'
}

function normalizePlanItems(rawInput: any): NormalizedPlanItem[] {
  let rawItems: any[] = []

  if (Array.isArray(rawInput)) {
    rawItems = rawInput
  } else if (rawInput && typeof rawInput === 'object') {
    if (Array.isArray(rawInput.plan)) rawItems = rawInput.plan
    else if (Array.isArray(rawInput.revision_plan)) rawItems = rawInput.revision_plan
    else if (Array.isArray(rawInput.items)) rawItems = rawInput.items
    else if (Array.isArray(rawInput.plan_data)) rawItems = rawInput.plan_data
    else if (Array.isArray(rawInput.topics)) rawItems = rawInput.topics
  }

  if (rawItems.length === 0) {
    return [
      {
        topic_name: 'Virtual Memory & TLB Address Translation',
        priority: 'high',
        estimated_hours: 4.5,
        strength: 'weak',
        completed: false,
        activities: [
          'Derive the EMAT latency equation with varying hit ratios (80%, 90%, 95%)',
          'Solve numerical problems on page table lookups and page faults',
          'Diagram the Working Set Window Δ against CPU utilization curve',
        ],
        resources: ['Lecture Notes Section 3.2', 'Midterm Exam Past Paper'],
      },
      {
        topic_name: 'Deadlocks & The Banker\'s Algorithm',
        priority: 'medium',
        estimated_hours: 2.5,
        strength: 'medium',
        completed: false,
        activities: [
          'Trace Banker\'s algorithm safety state vector with 5 processes and 3 resources',
          'Review the four Coffman conditions: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait',
        ],
        resources: ['Lecture Notes Section 2.4'],
      },
      {
        topic_name: 'Process Management & CPU Scheduling',
        priority: 'low',
        estimated_hours: 1.0,
        strength: 'strong',
        completed: true,
        activities: [
          'Quick 15-minute flashcard review of PCB register restoration and MLFQ aging',
        ],
        resources: ['Syllabus Module 1'],
      },
    ]
  }

  return rawItems.map((item, idx) => {
    const rawPriority = String(item?.priority || '').toLowerCase()
    const rawStrength = String(item?.strength || '').toLowerCase()

    const strength: 'weak' | 'medium' | 'strong' = ['weak', 'medium', 'strong'].includes(rawStrength)
      ? (rawStrength as 'weak' | 'medium' | 'strong')
      : rawPriority === 'high'
      ? 'weak'
      : rawPriority === 'low'
      ? 'strong'
      : 'medium'

    const priority: 'high' | 'medium' | 'low' = ['high', 'medium', 'low'].includes(rawPriority)
      ? (rawPriority as 'high' | 'medium' | 'low')
      : strength === 'weak'
      ? 'high'
      : strength === 'strong'
      ? 'low'
      : 'medium'

    const defaultHours = priority === 'high' ? 4 : priority === 'medium' ? 2.5 : 1.5
    const estimated_hours =
      typeof item?.estimated_hours === 'number' && item.estimated_hours > 0
        ? item.estimated_hours
        : defaultHours

    // Map activities from activities, suggestions, or reason
    let activities: string[] = []
    if (Array.isArray(item?.activities) && item.activities.length > 0) {
      activities = item.activities.map(String)
    } else if (Array.isArray(item?.suggestions) && item.suggestions.length > 0) {
      activities = item.suggestions.map(String)
    } else if (item?.reason) {
      activities = [
        `Remediate conceptual gap: ${String(item.reason)}`,
        'Solve targeted practice exercises and verify answers',
      ]
    } else {
      activities = [
        'Review core lecture notes and key formulas',
        'Practice relevant past exam problems',
      ]
    }

    // Map resources
    let resources: string[] = []
    if (Array.isArray(item?.resources) && item.resources.length > 0) {
      resources = item.resources.map(String)
    } else if (item?.reason && !activities.includes(String(item.reason))) {
      resources = [String(item.reason)]
    } else {
      resources = ['Course Materials & Lecture Notes']
    }

    return {
      topic_name: String(item?.topic_name || item?.name || `Topic ${idx + 1}`),
      priority,
      estimated_hours,
      activities,
      resources,
      completed: Boolean(item?.completed),
      strength,
    }
  })
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    let availableHours = 10
    try {
      const body = await request.json()
      if (typeof body.availableHours === 'number' && body.availableHours > 0) {
        availableHours = body.availableHours
      }
    } catch {
      // Use default 10 hours
    }

    // 1. Fetch latest gap reports for this user
    const { data: reports } = await supabase
      .from('gap_reports')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    let gapData: Array<{
      topic_name: string
      strength: 'weak' | 'medium' | 'strong'
      score: number
      reason?: string
      suggestions?: string[]
    }> = []

    let allTopics: string[] = []
    let gapReportIds: string[] = []

    if (reports && reports.length > 0) {
      const latestPerTopic: Record<string, typeof reports[0]> = {}
      for (const report of reports) {
        if (!latestPerTopic[report.topic_id]) {
          latestPerTopic[report.topic_id] = report
        }
      }

      gapReportIds = Object.values(latestPerTopic).map((r) => r.id)
      gapData = Object.values(latestPerTopic).map((r) => ({
        topic_name: r.topic_name,
        strength: r.strength as 'weak' | 'medium' | 'strong',
        score: r.score,
        reason: r.reason,
        suggestions: r.suggestions,
      }))
      allTopics = Object.values(latestPerTopic).map((r) => r.topic_name)
    } else {
      // 2. Fallback: check if user has topics in `topics` table
      const { data: userTopics } = await supabase
        .from('topics')
        .select('*')
        .eq('user_id', user.id)
        .is('parent_topic_id', null)

      if (userTopics && userTopics.length > 0) {
        gapData = userTopics.map((t) => ({
          topic_name: t.name,
          strength: (t.strength === 'untested' ? 'weak' : t.strength) as 'weak' | 'medium' | 'strong',
          score: t.score || (t.strength === 'weak' ? 33 : t.strength === 'medium' ? 60 : 85),
          reason: t.description || 'Topic identified for structured revision.',
          suggestions: ['Review core definitions and key problems.'],
        }))
        allTopics = userTopics.map((t) => t.name)
      } else {
        // 3. Fallback: use preloaded topics so revision plan ALWAYS works
        gapData = PRELOADED_TOPICS.map((t) => ({
          topic_name: t.name,
          strength: t.strength,
          score: t.score,
          reason: t.description,
          suggestions: t.subtopics.map((s) => s.name),
        }))
        allTopics = PRELOADED_TOPICS.map((t) => t.name)
      }
    }

    // Generate revision plan with AI (with built-in fallback)
    let rawPlanItems: any = null
    try {
      rawPlanItems = await generateRevisionPlan(gapData, availableHours, allTopics)
    } catch (genErr) {
      console.warn('Gemini revision plan generation error, falling back to structured topics:', genErr)
      rawPlanItems = gapData
    }
    const planItems = normalizePlanItems(rawPlanItems && Array.isArray(rawPlanItems) && rawPlanItems.length > 0 ? rawPlanItems : gapData)

    // Save plan to Supabase
    const { data: plan, error } = await supabase
      .from('revision_plans')
      .insert({
        user_id: user.id,
        gap_report_ids: gapReportIds,
        title: `Revision Plan (${availableHours}h Budget) - ${new Date().toLocaleDateString()}`,
        available_hours: availableHours,
        plan_data: planItems,
        status: 'active',
      })
      .select()
      .single()

    if (error) {
      console.error('Plan database save error:', error)
      return NextResponse.json(
        { error: `Database save error: ${error.message}` },
        { status: 500 }
      )
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Plan generation route exception:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal revision plan generation error' },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    let { data: plans, error } = await supabase
      .from('revision_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Revision plans fetch error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Auto-create initial plan if user has none, so the screen is never blank
    if (!plans || plans.length === 0) {
      try {
        const defaultItems = normalizePlanItems([])
        const { data: autoPlan } = await supabase
          .from('revision_plans')
          .insert({
            user_id: user.id,
            title: `Priority Revision Plan (8h Budget)`,
            available_hours: 8,
            plan_data: defaultItems,
            status: 'active',
          })
          .select()
          .single()

        if (autoPlan) {
          plans = [autoPlan]
        }
      } catch (autoErr) {
        console.warn('Auto-plan initial creation notice:', autoErr)
      }
    }

    // Ensure all plan_data is cleanly normalized
    const normalizedPlans = (plans || []).map((p) => ({
      ...p,
      plan_data: normalizePlanItems(p.plan_data),
    }))

    return NextResponse.json({ plans: normalizedPlans })
  } catch (error: any) {
    console.error('Plans fetch exception:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 })
    }

    const { planId, planData, status } = await request.json()

    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (planData) updates.plan_data = normalizePlanItems(planData)
    if (status) updates.status = status

    const { data: plan, error } = await supabase
      .from('revision_plans')
      .update(updates)
      .eq('id', planId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Plan update DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ plan })
  } catch (error: any) {
    console.error('Plan update route exception:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
