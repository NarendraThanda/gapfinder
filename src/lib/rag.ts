import { generateEmbedding, generateJSON, generateText } from './gemini'
import { createClient } from './supabase/client'

// ===== TEXT CHUNKING =====
export function chunkText(text: string, chunkSize: number = 800, overlap: number = 200): string[] {
  const chunks: string[] = []
  const sentences = text.split(/(?<=[.!?])\s+/)
  let currentChunk = ''

  for (const sentence of sentences) {
    if ((currentChunk + ' ' + sentence).length > chunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.trim())
      // Keep overlap
      const words = currentChunk.split(' ')
      const overlapWords = words.slice(-Math.floor(overlap / 5))
      currentChunk = overlapWords.join(' ') + ' ' + sentence
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(c => c.length > 50) // Filter out very short chunks
}

// ===== TOPIC EXTRACTION =====
export interface ExtractedTopic {
  name: string
  description: string
  subtopics: { name: string; description: string }[]
}

export async function extractTopics(syllabusText: string): Promise<ExtractedTopic[]> {
  const topics = await generateJSON<ExtractedTopic[]>(
    `Analyze the following syllabus/study material and extract the main topics and subtopics.
For each topic, provide a clear name and brief description.

SYLLABUS TEXT:
${syllabusText}

Return a JSON array where each element has:
- "name": topic name (string)
- "description": brief description of what this topic covers (string)
- "subtopics": array of { "name": string, "description": string }

Extract 5-15 main topics with their subtopics. Be specific and use the exact terminology from the syllabus.`,
    'You are an educational content analyzer. Extract topics and subtopics from study materials accurately. Always return valid JSON arrays.'
  )
  return topics
}

// ===== QUESTION GENERATION =====
export interface GeneratedQuestion {
  question: string
  options: string[]
  correct_answer: number
  explanation: string
  citation: string
  difficulty: 'easy' | 'medium' | 'hard'
  topic_name: string
}

export async function generateQuestions(
  context: string,
  topicName: string,
  count: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed'
): Promise<GeneratedQuestion[]> {
  const questions = await generateJSON<GeneratedQuestion[]>(
    `Generate ${count} multiple-choice quiz questions based ONLY on the following study material context.
Each question must be directly answerable from the provided material.

TOPIC: ${topicName}
DIFFICULTY: ${difficulty === 'mixed' ? 'mix of easy, medium, and hard' : difficulty}

STUDY MATERIAL CONTEXT:
${context}

Return a JSON array where each element has:
- "question": the question text (string)
- "options": exactly 4 answer options (string array of 4)
- "correct_answer": index of correct option, 0-based (number 0-3)
- "explanation": why the correct answer is right and others are wrong (string)
- "citation": quote the relevant part from the study material that contains the answer (string, max 100 words)
- "difficulty": "easy", "medium", or "hard" (string)
- "topic_name": "${topicName}" (string)

Rules:
1. Questions MUST be grounded in the provided context, not general knowledge
2. All 4 options must be plausible
3. Explanations must reference the study material
4. Citations must be actual quotes from the material`,
    'You are an expert quiz generator for educational purposes. Generate questions strictly from the provided material with accurate citations. Always return valid JSON arrays.'
  )
  return questions
}

// ===== ANSWER EVALUATION =====
export async function evaluateAnswer(
  question: string,
  studentAnswer: string,
  correctAnswer: string,
  context: string
): Promise<{ isCorrect: boolean; explanation: string }> {
  const result = await generateJSON<{ isCorrect: boolean; explanation: string }>(
    `Evaluate the student's answer to this question.

QUESTION: ${question}
STUDENT'S ANSWER: ${studentAnswer}
CORRECT ANSWER: ${correctAnswer}
RELEVANT MATERIAL: ${context}

Return JSON with:
- "isCorrect": boolean
- "explanation": detailed explanation of why the answer is correct or incorrect, referencing the study material`,
    'You are a fair and thorough educational evaluator. Provide clear explanations referencing the study material.'
  )
  return result
}

// ===== GAP ANALYSIS =====
export interface GapAnalysisResult {
  topic_name: string
  strength: 'weak' | 'medium' | 'strong'
  score: number
  reason: string
  suggestions: string[]
}

export async function analyzeGaps(
  quizResults: { topic_name: string; total: number; correct: number; questions: string[] }[]
): Promise<GapAnalysisResult[]> {
  const gaps = await generateJSON<GapAnalysisResult[]>(
    `Analyze the following quiz results and determine the student's strength in each topic.

QUIZ RESULTS:
${JSON.stringify(quizResults, null, 2)}

For each topic, determine:
- "weak": score below 40% or significant conceptual gaps
- "medium": score 40-70% or partial understanding
- "strong": score above 70% with good conceptual clarity

Return a JSON array where each element has:
- "topic_name": the topic name (string)
- "strength": "weak", "medium", or "strong" (string)
- "score": percentage score 0-100 (number)
- "reason": detailed explanation of WHY the student is weak/medium/strong in this topic, referencing specific questions they got wrong (string)
- "suggestions": array of 2-3 specific study suggestions for improvement (string array)`,
    'You are an educational diagnostician. Analyze quiz performance to identify genuine knowledge gaps. Be specific and actionable in your analysis.'
  )
  return gaps
}

// ===== REVISION PLAN GENERATION =====
export interface PlanItem {
  topic_name: string
  priority: 'high' | 'medium' | 'low'
  estimated_hours: number
  activities: string[]
  resources: string[]
  strength: 'weak' | 'medium' | 'strong'
}

export async function generateRevisionPlan(
  gaps: GapAnalysisResult[],
  availableHours: number,
  existingTopics: string[]
): Promise<PlanItem[]> {
  const plan = await generateJSON<PlanItem[]>(
    `Create a personalized revision plan based on the student's gap analysis.

GAP ANALYSIS:
${JSON.stringify(gaps, null, 2)}

AVAILABLE STUDY HOURS: ${availableHours}
ALL TOPICS: ${existingTopics.join(', ')}

Create a prioritized revision plan that:
1. Allocates MORE time to weak topics
2. Some time for medium topics
3. Brief review time for strong topics
4. Total hours should not exceed ${availableHours}
5. Activities should be specific and actionable

Return a JSON array where each element has:
- "topic_name": topic name (string)
- "priority": "high" for weak, "medium" for medium, "low" for strong (string)
- "estimated_hours": hours to spend (number)
- "activities": array of 2-4 specific study activities (string array)
- "resources": array of relevant sections to focus on (string array)
- "strength": current strength level (string)

Sort by priority: high first, then medium, then low.`,
    'You are an expert study planner. Create realistic, actionable revision plans that prioritize weak areas while maintaining strong ones.'
  )
  return plan
}

// ===== RAG CHAT =====
export async function ragChat(
  question: string,
  context: string,
  chatHistory: { role: string; content: string }[] = []
): Promise<{ answer: string; citations: { source: string; content: string }[] }> {
  const historyStr = chatHistory
    .slice(-6) // Last 6 messages for context
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')

  const result = await generateJSON<{ answer: string; citations: { source: string; content: string }[] }>(
    `Answer the student's question using ONLY the provided study material. Include citations.

STUDY MATERIAL CONTEXT:
${context}

${historyStr ? `CONVERSATION HISTORY:\n${historyStr}\n` : ''}

STUDENT'S QUESTION: ${question}

Return JSON with:
- "answer": comprehensive answer using only the provided material (string, use markdown formatting)
- "citations": array of { "source": "material section", "content": "relevant quote from material" }

Rules:
1. ONLY use information from the provided material
2. If the material doesn't contain enough info, say so clearly
3. Always include at least one citation
4. Use clear, educational language`,
    'You are a helpful study assistant. Answer questions using ONLY the provided study material. Always cite your sources. Be educational and thorough.'
  )
  return result
}

// ===== VECTOR SEARCH =====
export async function searchSimilarChunks(
  query: string,
  userId: string,
  limit: number = 5,
  materialId?: string | null
): Promise<{ content: string; topic_hint: string | null; similarity: number }[]> {
  const supabase = createClient()
  const embedding = await generateEmbedding(query)

  const params: any = {
    query_embedding: embedding,
    match_user_id: userId,
    match_count: limit,
    match_threshold: 0.3,
  }
  if (materialId) {
    params.match_material_id = materialId
  }

  const { data, error } = await supabase.rpc('match_chunks', params)

  if (error) {
    console.error('Vector search error:', error)
    return []
  }

  return data || []
}
