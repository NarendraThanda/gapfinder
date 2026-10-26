import { generateEmbedding, generateJSON, generateText, isCleanOptionText, cleanOptionText, synthesizeGroundedAnswer } from './gemini'
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

function synthesizeFallbackQuestion(topicName: string, index: number, difficulty: 'easy' | 'medium' | 'hard' = 'medium'): GeneratedQuestion {
  const templates = [
    {
      q: `What is the primary role or mechanism of ${topicName} in the curriculum?`,
      opts: [
        `Defines fundamental principles and core operational behavior`,
        `Acts as a temporary secondary fallback with no practical impact`,
        `Deprecated legacy protocol no longer applied in modern environments`,
        `External compilation utility exclusively executed during build phases`,
      ],
      correct: 0,
      exp: `Understanding ${topicName} requires grasping its primary operational principles and role in the curriculum.`,
    },
    {
      q: `Which of the following best describes an essential advantage of ${topicName}?`,
      opts: [
        `Provides structured efficiency, consistency, and verifiable correctness`,
        `Guarantees zero memory allocation under all computational loads`,
        `Completely eliminates the requirement for underlying architectural components`,
        `Restricts runtime operations to synchronous single-threaded execution`,
      ],
      correct: 0,
      exp: `${topicName} provides key architectural advantages including consistency and verifiable correctness.`,
    },
    {
      q: `When applying ${topicName}, which consideration is most critical?`,
      opts: [
        `Validating boundary conditions and maintaining state integrity`,
        `Ignoring edge-case parameters during initial configuration`,
        `Maximizing redundant transformations across data pipelines`,
        `Bypassing systematic error handling for performance gains`,
      ],
      correct: 0,
      exp: `State integrity and boundary validation are fundamental requirements when applying ${topicName}.`,
    },
    {
      q: `How does ${topicName} interact with surrounding modular components?`,
      opts: [
        `Through well-defined contracts, standard protocols, and predictable interfaces`,
        `By directly modifying external private state without coordination`,
        `Through undocumented hardware interruptions and random polling`,
        `By bypassing communication layers and forcing thread termination`,
      ],
      correct: 0,
      exp: `Modular design principles dictate that ${topicName} communicates via clear contracts and interfaces.`,
    },
  ]

  const t = templates[index % templates.length]
  return {
    question: t.q,
    options: [...t.opts],
    correct_answer: t.correct,
    explanation: t.exp,
    citation: `Curriculum specification and study material for ${topicName}.`,
    difficulty,
    topic_name: topicName,
  }
}

export function validateAndCleanQuestions(
  rawQuestions: any[],
  topicName: string,
  targetCount: number = 3,
  defaultDifficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed'
): GeneratedQuestion[] {
  const cleanedQuestions: GeneratedQuestion[] = []

  if (Array.isArray(rawQuestions)) {
    for (const raw of rawQuestions) {
      if (!raw || typeof raw !== 'object') continue

      // 1. Validate Question Text
      const qText = typeof raw.question === 'string' ? raw.question.trim() : ''
      if (qText.length < 8 || !isCleanOptionText(qText)) {
        continue // Corrupt or unreadable question text
      }

      // 2. Validate and Clean Options
      const rawOptions = Array.isArray(raw.options) ? raw.options : []
      const validOptions: string[] = []
      const seen = new Set<string>()

      for (const opt of rawOptions) {
        const cleaned = cleanOptionText(opt)
        const lower = cleaned.toLowerCase()
        if (cleaned.length >= 2 && isCleanOptionText(cleaned) && !seen.has(lower)) {
          seen.add(lower)
          validOptions.push(cleaned)
        }
      }

      // If we don't have enough clean options, backfill with clean plausible choices
      const defaultDistractors = [
        `It establishes foundational principles and core guidelines for ${topicName}.`,
        `It optimizes performance and minimizes unnecessary computational overhead.`,
        `It provides standardized communication protocols across system components.`,
        `It enforces boundary checks and validates dynamic state transitions.`,
      ]

      let distractorIdx = 0
      while (validOptions.length < 4 && distractorIdx < defaultDistractors.length) {
        const d = defaultDistractors[distractorIdx++]
        if (!seen.has(d.toLowerCase())) {
          seen.add(d.toLowerCase())
          validOptions.push(d)
        }
      }

      // Take exactly 4 options
      const finalOptions = validOptions.slice(0, 4)
      if (finalOptions.length < 4) continue // Still not enough

      // 3. Validate Correct Answer Index
      let correctIdx = typeof raw.correct_answer === 'number' ? Math.floor(raw.correct_answer) : 0
      if (isNaN(correctIdx) || correctIdx < 0 || correctIdx >= finalOptions.length) {
        correctIdx = 0
      }

      // 4. Validate Explanation and Citation
      const explanation = typeof raw.explanation === 'string' && raw.explanation.trim().length > 5
        ? raw.explanation.trim()
        : `Explanation based on core concepts of ${topicName}.`

      const citation = typeof raw.citation === 'string' && raw.citation.trim().length > 3
        ? raw.citation.trim()
        : `Course study material on ${topicName}.`

      // 5. Validate Difficulty
      let diff: 'easy' | 'medium' | 'hard' = 'medium'
      if (raw.difficulty === 'easy' || raw.difficulty === 'hard') {
        diff = raw.difficulty
      } else if (defaultDifficulty === 'easy' || defaultDifficulty === 'hard') {
        diff = defaultDifficulty
      }

      cleanedQuestions.push({
        question: qText,
        options: finalOptions,
        correct_answer: correctIdx,
        explanation,
        citation,
        difficulty: diff,
        topic_name: topicName,
      })

      if (cleanedQuestions.length >= targetCount) break
    }
  }

  // If questions are still fewer than targetCount, synthesize clean structured questions
  while (cleanedQuestions.length < targetCount) {
    const fallback = synthesizeFallbackQuestion(
      topicName,
      cleanedQuestions.length,
      defaultDifficulty === 'hard' ? 'hard' : defaultDifficulty === 'easy' ? 'easy' : 'medium'
    )
    cleanedQuestions.push(fallback)
  }

  return cleanedQuestions
}

export async function generateQuestions(
  context: string,
  topicName: string,
  count: number = 5,
  difficulty: 'easy' | 'medium' | 'hard' | 'mixed' = 'mixed'
): Promise<GeneratedQuestion[]> {
  try {
    const rawQuestions = await generateJSON<GeneratedQuestion[]>(
      `Generate ${count} multiple-choice quiz questions based ONLY on the following study material context.
Each question must be directly answerable from the provided material.

TOPIC: ${topicName}
DIFFICULTY: ${difficulty === 'mixed' ? 'mix of easy, medium, and hard' : difficulty}

STUDY MATERIAL CONTEXT:
${context}

Return a JSON array where each element has:
- "question": the question text (clean natural language string, no font stream or symbol codes)
- "options": exactly 4 distinct, readable answer options (string array of 4). DO NOT prefix options with letters like "A)", "B.", or numbers; return only the option text.
- "correct_answer": index of correct option, 0-based (number 0, 1, 2, or 3)
- "explanation": why the correct answer is right and others are wrong (clear educational string)
- "citation": quote the relevant part from the study material that contains the answer (string, max 100 words)
- "difficulty": "easy", "medium", or "hard" (string)
- "topic_name": "${topicName}" (string)

Rules:
1. Questions MUST be grounded in the provided context, not general knowledge.
2. Every option MUST be clean, readable English text. Never output raw tokens, byte fragments, or random symbols.
3. Options must NOT have letter prefixes (e.g., write "Active Transport" NOT "A) Active Transport").
4. Exactly one option is correct, matching the 0-based "correct_answer" index.
5. All 4 options must be plausible distractors.`,
      'You are an expert quiz generator for educational purposes. Generate questions strictly from the provided material with accurate citations. Always return valid JSON arrays with clean, human-readable option strings.'
    )

    return validateAndCleanQuestions(rawQuestions, topicName, count, difficulty)
  } catch (err) {
    console.warn(`generateQuestions failed for topic ${topicName}, falling back to validated synthesis:`, err)
    return validateAndCleanQuestions([], topicName, count, difficulty)
  }
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
  chatHistory: { role: string; content: string }[] = [],
  materialTitles: string[] = []
): Promise<{ answer: string; citations: { source: string; content: string }[] }> {
  const historyStr = chatHistory
    .slice(-6)
    .map(m => `${m.role}: ${m.content}`)
    .join('\n')

  try {
    const result = await generateJSON<{ answer: string; citations: { source: string; content: string }[] }>(
      `Answer the student's question using the provided study material. Include citations.

STUDY MATERIAL CONTEXT:
${context}

${historyStr ? `CONVERSATION HISTORY:\n${historyStr}\n` : ''}

STUDENT'S QUESTION: ${question}

Return JSON with:
- "answer": comprehensive answer using the provided material (string, use clean markdown formatting with headings, bullet points, and code/math blocks where appropriate)
- "citations": array of { "source": "material section or title", "content": "relevant quote or summary" }

Rules:
1. Ground your response in the provided material.
2. If the question is a greeting or general study question, answer helpfully while referencing how the materials relate.
3. Use clear, educational language. Format equations cleanly with LaTeX or code blocks.`,
      'You are an expert AI tutor. Answer questions using the provided study material. Always cite your sources. Be educational and thorough.'
    )

    if (result && typeof result.answer === 'string' && result.answer.trim().length > 30) {
      return {
        answer: result.answer.trim(),
        citations: Array.isArray(result.citations) ? result.citations : [],
      }
    }
  } catch (err) {
    console.warn('ragChat JSON generation failed, falling back to direct synthesis:', err)
  }

  // Robust grounded synthesis fallback
  try {
    const synth = synthesizeGroundedAnswer(question, context, materialTitles)
    if (synth && synth.answer && synth.answer.length > 30) {
      return synth
    }
  } catch (synthErr) {
    console.error('synthesizeGroundedAnswer error:', synthErr)
  }

  // Secondary fallback: generateText
  try {
    const textAnswer = await generateText(
      `You are a knowledgeable AI tutor. Answer the student's question using the provided study material context.

STUDY MATERIAL CONTEXT:
${context}

${historyStr ? `CONVERSATION HISTORY:\n${historyStr}\n` : ''}

STUDENT'S QUESTION: ${question}

Provide a clear, educational, and well-structured markdown answer. Cite the relevant material where possible.`,
      'You are a helpful educational tutor.'
    )

    return {
      answer: textAnswer || "I'm having trouble analyzing the study material right now. Please try again.",
      citations: context ? [{ source: materialTitles[0] || 'Study Material', content: context.slice(0, 150) + '...' }] : [],
    }
  } catch (fallbackErr) {
    console.error('ragChat fallback failed:', fallbackErr)
    return {
      answer: "I'm currently unable to retrieve a response from the AI tutor. Please check your connection and try again.",
      citations: [],
    }
  }
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
    match_threshold: 0.15,
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
