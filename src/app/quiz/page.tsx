'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import AppLayout from '@/components/AppLayout'
import {
  LuBrain,
  LuSparkles,
  LuClock,
  LuCircleCheck,
  LuCircleX,
  LuQuote,
  LuArrowRight,
  LuLoader,
  LuRotateCcw,
  LuFileText,
} from 'react-icons/lu'

interface Topic {
  id: string
  name: string
  strength: string
  score: number
}

interface QuizQuestion {
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

interface QuizSession {
  id: string
  title: string
  total_questions: number
}

export default function DiagnosticQuizPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-sm text-gray-400">Loading diagnostic quiz...</div>}>
      <DiagnosticQuizContent />
    </Suspense>
  )
}

function DiagnosticQuizContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedTopicId = searchParams.get('topicId')

  const [topics, setTopics] = useState<Topic[]>([])
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([])
  const [questionsPerTopic, setQuestionsPerTopic] = useState(2)
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('mixed')

  // Quiz state
  const [loadingTopics, setLoadingTopics] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [quiz, setQuiz] = useState<QuizSession | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedOption, setSelectedOption] = useState<number | null>(null)
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false)
  const [answersState, setAnswersState] = useState<Record<number, { selected: number; isCorrect: boolean }>>({})
  const [evaluatingDiagnosis, setEvaluatingDiagnosis] = useState(false)
  const [startTime, setStartTime] = useState<number>(Date.now())

  useEffect(() => {
    async function loadTopics() {
      try {
        setLoadingTopics(true)
        const res = await fetch('/api/topics')
        if (res.ok) {
          const data = await res.json()
          const topicList: Topic[] = data.topics || []
          setTopics(topicList)

          if (preselectedTopicId) {
            setSelectedTopicIds([preselectedTopicId])
          } else if (topicList.length > 0) {
            // Select all topics by default for a thorough check
            setSelectedTopicIds(topicList.map((t) => t.id))
          }
        }
      } catch (err) {
        console.error('Failed to load topics:', err)
      } finally {
        setLoadingTopics(false)
      }
    }
    loadTopics()
  }, [preselectedTopicId])

  const toggleTopicSelection = (id: string) => {
    setSelectedTopicIds((prev) =>
      prev.includes(id) ? prev.filter((tId) => tId !== id) : [...prev, id]
    )
  }

  const handleStartQuiz = async () => {
    if (selectedTopicIds.length === 0) return
    try {
      setGenerating(true)
      const res = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topicIds: selectedTopicIds,
          questionsPerTopic,
          difficulty,
        }),
      })

      const data = await res.json()
      if (res.ok && data.quiz && data.questions?.length > 0) {
        setQuiz(data.quiz)
        setQuestions(data.questions)
        setCurrentIndex(0)
        setSelectedOption(null)
        setHasSubmittedAnswer(false)
        setAnswersState({})
        setStartTime(Date.now())
      } else {
        alert(data.error || 'Could not generate questions. Ensure study materials are uploaded!')
      }
    } catch (err) {
      console.error('Quiz creation error:', err)
      alert('Error connecting to quiz generation engine.')
    } finally {
      setGenerating(false)
    }
  }

  const handleSelectOption = (idx: number) => {
    if (hasSubmittedAnswer) return
    setSelectedOption(idx)
  }

  const handleSubmitCurrentAnswer = async () => {
    if (selectedOption === null || !quiz) return
    const currentQ = questions[currentIndex]
    const isCorrect = selectedOption === currentQ.correct_answer
    const timeTaken = Math.round((Date.now() - startTime) / 1000)

    setHasSubmittedAnswer(true)
    setAnswersState((prev) => ({
      ...prev,
      [currentIndex]: { selected: selectedOption, isCorrect },
    }))

    try {
      await fetch('/api/quiz/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quizId: quiz.id,
          questionId: currentQ.id,
          selectedAnswer: selectedOption,
          isCorrect,
          timeTaken,
        }),
      })
    } catch (err) {
      console.error('Error submitting answer:', err)
    }
  }

  const handleNextQuestion = async () => {
    if (currentIndex + 1 < questions.length) {
      setCurrentIndex((prev) => prev + 1)
      setSelectedOption(null)
      setHasSubmittedAnswer(false)
      setStartTime(Date.now())
    } else {
      // Completed all questions -> Trigger Gap Diagnosis!
      if (!quiz) return
      setEvaluatingDiagnosis(true)
      try {
        const res = await fetch('/api/gap-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quizId: quiz.id }),
        })
        if (res.ok) {
          router.push(`/gap-report?quizId=${quiz.id}`)
        } else {
          router.push('/gap-report')
        }
      } catch (err) {
        console.error('Error triggering diagnosis:', err)
        router.push('/gap-report')
      }
    }
  }

  const currentQ = questions[currentIndex]
  const progressPercent = questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0

  return (
    <AppLayout
      headerTitle="Diagnostic Assessment"
      headerSubtitle="Questions generated strictly from your uploaded materials with grounded citations"
    >
      <div className="max-w-4xl mx-auto pb-12">
        {/* State 1: Configuration / Topic Selection */}
        {!quiz && (
          <div className="glass p-8 space-y-8 animate-fadeIn">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 mb-3">
                <LuSparkles size={14} /> Grounded Question Generation
              </div>
              <h2 className="text-2xl font-bold text-white">
                Configure Diagnostic Quiz
              </h2>
              <p className="text-xs md:text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                Select topics from your syllabus to test. Every generated question will cite the exact section in your uploaded textbook or notes.
              </p>
            </div>

            {loadingTopics ? (
              <div className="flex items-center justify-center py-12 gap-3 text-sm text-gray-400">
                <LuLoader className="animate-spin" size={20} />
                <span>Fetching curriculum topics...</span>
              </div>
            ) : topics.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-white/10 text-center space-y-3">
                <LuFileText className="mx-auto text-gray-500" size={36} />
                <p className="text-sm font-semibold text-white">No Topics Available to Test</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Upload your syllabus first, or preload the sample course from the dashboard.
                </p>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="btn-secondary text-xs py-2 px-4"
                >
                  Go to Dashboard to Preload
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold uppercase tracking-wider text-purple-300">
                      Select Topics to Assess ({selectedTopicIds.length}/{topics.length})
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedTopicIds(topics.map((t) => t.id))}
                        className="text-[11px] text-purple-400 hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-gray-600">•</span>
                      <button
                        type="button"
                        onClick={() => setSelectedTopicIds([])}
                        className="text-[11px] text-gray-400 hover:underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  <div className="grid md:grid-cols-2 gap-3">
                    {topics.map((topic) => {
                      const isSelected = selectedTopicIds.includes(topic.id)
                      return (
                        <div
                          key={topic.id}
                          onClick={() => toggleTopicSelection(topic.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500/10 text-white shadow-md shadow-purple-500/10'
                              : 'border-white/10 bg-white/[0.02] text-gray-400 hover:border-white/20'
                          }`}
                        >
                          <div className="space-y-1 min-w-0">
                            <h4 className="text-sm font-semibold truncate text-white">{topic.name}</h4>
                            <div className="flex items-center gap-2 text-[11px]">
                              <span className="capitalize text-gray-400">Score: {topic.score}%</span>
                            </div>
                          </div>

                          <div
                            className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'border-purple-400 bg-purple-500 text-white'
                                : 'border-gray-500'
                            }`}
                          >
                            {isSelected && <LuCircleCheck size={14} />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-2">
                      Questions Per Topic
                    </label>
                    <select
                      className="input-glass text-xs"
                      value={questionsPerTopic}
                      onChange={(e) => setQuestionsPerTopic(Number(e.target.value))}
                    >
                      <option value={1} className="bg-slate-900">1 question (Quick check)</option>
                      <option value={2} className="bg-slate-900">2 questions (Balanced diagnostic)</option>
                      <option value={3} className="bg-slate-900">3 questions (In-depth gap analysis)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-purple-300 mb-2">
                      Difficulty Level
                    </label>
                    <select
                      className="input-glass text-xs"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as any)}
                    >
                      <option value="mixed" className="bg-slate-900">Mixed (Conceptual & Applied)</option>
                      <option value="easy" className="bg-slate-900">Easy (Foundational)</option>
                      <option value="medium" className="bg-slate-900">Medium (Standard Exam Level)</option>
                      <option value="hard" className="bg-slate-900">Hard (Deep edge cases)</option>
                    </select>
                  </div>
                </div>

                <button
                  onClick={handleStartQuiz}
                  disabled={generating || selectedTopicIds.length === 0}
                  className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
                  id="generate-quiz-btn"
                >
                  {generating ? (
                    <>
                      <LuLoader className="animate-spin" size={20} />
                      <span>Retrieving chunks & generating grounded questions...</span>
                    </>
                  ) : (
                    <>
                      <LuBrain size={20} />
                      <span>
                        Generate & Begin Diagnostic Quiz ({selectedTopicIds.length * questionsPerTopic} Questions)
                      </span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* State 2: Taking Quiz */}
        {quiz && currentQ && (
          <div className="space-y-6 animate-fadeIn">
            {/* Quiz Top Progress */}
            <div className="glass p-5 flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-purple-400">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <span className="text-gray-400 capitalize">
                    Difficulty: {currentQ.difficulty}
                  </span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-gray-400 pl-4 border-l border-white/10 shrink-0">
                <LuClock size={16} className="text-purple-400" />
                <span>Diagnostic Mode</span>
              </div>
            </div>

            {/* Question Card */}
            <div className="glass p-6 md:p-8 space-y-6">
              <h3 className="text-lg md:text-xl font-bold text-white leading-relaxed">
                {currentQ.question}
              </h3>

              {/* Options */}
              <div className="space-y-3">
                {currentQ.options.map((option, idx) => {
                  const isSelected = selectedOption === idx
                  const isCorrect = idx === currentQ.correct_answer

                  let optionStyle = 'border-white/10 bg-white/[0.02] text-gray-300 hover:border-purple-400/40'

                  if (hasSubmittedAnswer) {
                    if (isCorrect) {
                      optionStyle = 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                    } else if (isSelected && !isCorrect) {
                      optionStyle = 'border-red-500 bg-red-500/15 text-red-200'
                    } else {
                      optionStyle = 'border-white/5 opacity-50'
                    }
                  } else if (isSelected) {
                    optionStyle = 'border-purple-500 bg-purple-500/15 text-white shadow-md shadow-purple-500/20'
                  }

                  return (
                    <div
                      key={idx}
                      onClick={() => handleSelectOption(idx)}
                      className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-4 ${optionStyle}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold bg-white/5 border border-white/10 shrink-0">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <span className="text-sm">{option}</span>
                      </div>

                      {hasSubmittedAnswer && (
                        <div className="shrink-0">
                          {isCorrect && <LuCircleCheck className="text-emerald-400" size={20} />}
                          {isSelected && !isCorrect && <LuCircleX className="text-red-400" size={20} />}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Grounded Citation & Explanation Reveal */}
              {hasSubmittedAnswer && (
                <div className="space-y-4 pt-4 border-t border-white/10 animate-fadeIn">
                  <div
                    className={`p-4 rounded-xl border text-sm space-y-2 ${
                      selectedOption === currentQ.correct_answer
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border-red-500/30 bg-red-500/10 text-red-300'
                    }`}
                  >
                    <div className="font-bold flex items-center gap-2">
                      {selectedOption === currentQ.correct_answer ? (
                        <>
                          <LuCircleCheck size={18} />
                          <span>Correct Diagnostic Response!</span>
                        </>
                      ) : (
                        <>
                          <LuCircleX size={18} />
                          <span>Misconception / Gap Detected</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs leading-relaxed opacity-90">{currentQ.explanation}</p>
                  </div>

                  {/* Mandatory Citation Display */}
                  {currentQ.citation && (
                    <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-purple-300">
                        <LuQuote size={14} /> Grounded Source Citation
                      </div>
                      <blockquote className="text-xs italic text-gray-300 border-l-2 border-purple-400 pl-3">
                        &quot;{currentQ.citation}&quot;
                      </blockquote>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        Retrieved directly from your uploaded course notes via RAG vector search.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4">
                <button
                  onClick={() => {
                    if (confirm('Cancel this quiz and return to configuration?')) {
                      setQuiz(null)
                    }
                  }}
                  className="text-xs text-gray-400 hover:text-white flex items-center gap-1"
                >
                  <LuRotateCcw size={14} />
                  <span>Quit Assessment</span>
                </button>

                {!hasSubmittedAnswer ? (
                  <button
                    onClick={handleSubmitCurrentAnswer}
                    disabled={selectedOption === null}
                    className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2"
                    id="submit-answer-btn"
                  >
                    <span>Check Answer</span>
                    <LuArrowRight size={16} />
                  </button>
                ) : (
                  <button
                    onClick={handleNextQuestion}
                    disabled={evaluatingDiagnosis}
                    className="btn-primary py-2.5 px-6 text-sm flex items-center gap-2"
                    id="next-question-btn"
                  >
                    {evaluatingDiagnosis ? (
                      <>
                        <LuLoader className="animate-spin" size={16} />
                        <span>Compiling AI Gap Diagnosis...</span>
                      </>
                    ) : currentIndex + 1 < questions.length ? (
                      <>
                        <span>Next Question</span>
                        <LuArrowRight size={16} />
                      </>
                    ) : (
                      <>
                        <span>Finish & View Gap Report</span>
                        <LuSparkles size={16} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}
