export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Material {
  id: string
  user_id: string
  title: string
  type: 'syllabus' | 'notes' | 'textbook' | 'question_paper'
  file_name: string
  file_url: string | null
  raw_text: string
  status: 'processing' | 'ready' | 'error'
  created_at: string
}

export interface MaterialChunk {
  id: string
  material_id: string
  user_id: string
  content: string
  topic_hint: string | null
  chunk_index: number
  embedding: number[] | null
  metadata: Record<string, unknown>
}

export interface Topic {
  id: string
  user_id: string
  material_id: string | null
  name: string
  parent_topic_id: string | null
  description: string | null
  order_index: number
  strength: 'weak' | 'medium' | 'strong' | 'untested'
  score: number
  created_at: string
}

export interface Quiz {
  id: string
  user_id: string
  title: string
  topic_ids: string[]
  total_questions: number
  answered_questions: number
  correct_answers: number
  status: 'in_progress' | 'completed'
  created_at: string
  completed_at: string | null
}

export interface QuizQuestion {
  id: string
  quiz_id: string
  topic_id: string | null
  question: string
  options: string[]
  correct_answer: number
  explanation: string
  citation: string
  difficulty: 'easy' | 'medium' | 'hard'
  order_index: number
}

export interface QuizAnswer {
  id: string
  quiz_id: string
  question_id: string
  user_id: string
  selected_answer: number
  is_correct: boolean
  time_taken_seconds: number
  created_at: string
}

export interface GapReport {
  id: string
  user_id: string
  quiz_id: string
  topic_id: string
  topic_name: string
  strength: 'weak' | 'medium' | 'strong'
  score: number
  total_questions: number
  correct_answers: number
  reason: string
  suggestions: string[]
  created_at: string
}

export interface RevisionPlan {
  id: string
  user_id: string
  gap_report_ids: string[]
  title: string
  available_hours: number
  plan_data: RevisionPlanItem[]
  status: 'active' | 'completed' | 'archived'
  created_at: string
  updated_at: string
}

export interface RevisionPlanItem {
  topic_id: string
  topic_name: string
  priority: 'high' | 'medium' | 'low'
  estimated_hours: number
  activities: string[]
  resources: string[]
  completed: boolean
  strength: 'weak' | 'medium' | 'strong'
}

export interface ProgressHistory {
  id: string
  user_id: string
  topic_id: string
  topic_name: string
  score: number
  strength: 'weak' | 'medium' | 'strong'
  quiz_id: string
  recorded_at: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  citations?: Citation[]
  timestamp: string
}

export interface Citation {
  source: string
  section: string
  content: string
}

export type TopicStrength = 'weak' | 'medium' | 'strong' | 'untested'
