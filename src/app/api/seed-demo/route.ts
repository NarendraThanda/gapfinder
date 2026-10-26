import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { SAMPLE_SYLLABUS, SAMPLE_NOTES, SAMPLE_QUESTIONS_PAPER, PRELOADED_TOPICS } from '@/lib/sampleData'
import { chunkText } from '@/lib/rag'

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Please log in to seed sample data' }, { status: 401 })
    }

    // 1. Insert Sample Materials
    const { data: syllabusMaterial } = await supabase
      .from('materials')
      .insert({
        user_id: user.id,
        title: 'CS301: Operating Systems & Architecture Official Syllabus',
        type: 'syllabus',
        file_name: 'CS301_Syllabus_2026.pdf',
        raw_text: SAMPLE_SYLLABUS,
        status: 'ready',
      })
      .select()
      .single()

    const { data: notesMaterial } = await supabase
      .from('materials')
      .insert({
        user_id: user.id,
        title: 'OS Lecture Notes — Memory Hierarchy & Banker\'s Algorithm',
        type: 'notes',
        file_name: 'OS_Module_2_and_3_Notes.pdf',
        raw_text: SAMPLE_NOTES,
        status: 'ready',
      })
      .select()
      .single()

    const { data: examMaterial } = await supabase
      .from('materials')
      .insert({
        user_id: user.id,
        title: 'Fall 2025 Midterm Exam Past Paper & Solutions',
        type: 'question_paper',
        file_name: 'Midterm_Past_Paper_2025.pdf',
        raw_text: SAMPLE_QUESTIONS_PAPER,
        status: 'ready',
      })
      .select()
      .single()

    // 2. Insert Chunks for RAG
    const notesChunks = chunkText(SAMPLE_NOTES)
    const syllabusChunks = chunkText(SAMPLE_SYLLABUS)

    for (let i = 0; i < notesChunks.length; i++) {
      await supabase.from('material_chunks').insert({
        material_id: notesMaterial?.id || syllabusMaterial?.id,
        user_id: user.id,
        content: notesChunks[i],
        chunk_index: i,
        topic_hint: 'Operating Systems Principles',
        metadata: { source: 'OS_Module_Notes.pdf' },
      })
    }

    for (let i = 0; i < syllabusChunks.length; i++) {
      await supabase.from('material_chunks').insert({
        material_id: syllabusMaterial?.id,
        user_id: user.id,
        content: syllabusChunks[i],
        chunk_index: i,
        topic_hint: 'Syllabus Breakdown',
        metadata: { source: 'CS301_Syllabus.pdf' },
      })
    }

    // 3. Insert Topics Hierarchy
    const insertedParentTopics = []
    for (let i = 0; i < PRELOADED_TOPICS.length; i++) {
      const topicData = PRELOADED_TOPICS[i]
      const { data: parent } = await supabase
        .from('topics')
        .insert({
          user_id: user.id,
          material_id: syllabusMaterial?.id,
          name: topicData.name,
          description: topicData.description,
          order_index: i,
          strength: topicData.strength,
          score: topicData.score,
        })
        .select()
        .single()

      if (parent) {
        insertedParentTopics.push(parent)
        for (let j = 0; j < topicData.subtopics.length; j++) {
          await supabase.from('topics').insert({
            user_id: user.id,
            material_id: syllabusMaterial?.id,
            parent_topic_id: parent.id,
            name: topicData.subtopics[j].name,
            description: topicData.subtopics[j].description,
            order_index: j,
            strength: topicData.strength,
            score: topicData.score,
          })
        }
      }
    }

    // 4. Create a Sample Diagnostic Quiz
    const vmTopic = insertedParentTopics.find(t => t.name.includes('Virtual Memory'))
    const deadlockTopic = insertedParentTopics.find(t => t.name.includes('Deadlocks'))
    const schedTopic = insertedParentTopics.find(t => t.name.includes('Scheduling'))

    const { data: sampleQuiz } = await supabase
      .from('quizzes')
      .insert({
        user_id: user.id,
        material_id: syllabusMaterial?.id,
        title: 'Diagnostic Quiz: Midterm Readiness Assessment',
        topic_ids: insertedParentTopics.map(t => t.id),
        total_questions: 4,
        answered_questions: 4,
        correct_answers: 2,
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (sampleQuiz) {
      // Question 1: Virtual Memory EMAT calculation (Wrong answer to showcase Gap)
      const { data: q1 } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: sampleQuiz.id,
          topic_id: vmTopic?.id || null,
          question: 'If main memory access takes 100ns, TLB search is 2ns, and the TLB hit ratio is 90%, what is the Effective Memory Access Time (EMAT)?',
          options: ['102ns', '112ns', '200ns', '90ns'],
          correct_answer: 1,
          explanation: 'EMAT = (100 + 2)*0.90 + (2*100 + 2)*0.10 = 91.8 + 20.2 = 112ns. A miss requires two memory accesses plus TLB latency.',
          citation: 'Section 3.2: "EMAT = (m + ε) * α + (2m + ε) * (1 - α)... with hit ratio 90%, TLB lookup 2ns, and memory access 100ns: EMAT = 112ns"',
          difficulty: 'hard',
          order_index: 0,
        })
        .select()
        .single()

      // Question 2: Thrashing (Wrong answer)
      const { data: q2 } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: sampleQuiz.id,
          topic_id: vmTopic?.id || null,
          question: 'What primary condition triggers catastrophic system thrashing in demand paging?',
          options: [
            'Excessive TLB cache invalidation during context switches',
            'When the sum of all processes\' working sets exceeds total physical memory frames',
            'A disk arm failure during elevator SCAN scheduling',
            'Circular wait during shared memory buffer allocation',
          ],
          correct_answer: 1,
          explanation: 'Thrashing occurs when memory allocation is smaller than active working sets, causing continuous page swapping and zero CPU progress.',
          citation: 'Section 3.3: "Peter Denning\'s Working Set Model resolves thrashing... ensuring a process is only allocated frames if its entire working set fits in memory."',
          difficulty: 'medium',
          order_index: 1,
        })
        .select()
        .single()

      // Question 3: Coffman conditions (Correct answer)
      const { data: q3 } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: sampleQuiz.id,
          topic_id: deadlockTopic?.id || null,
          question: 'Which of the following is NOT one of the four Coffman conditions necessary for deadlock to occur?',
          options: [
            'Mutual Exclusion',
            'Hold and Wait',
            'Preemptive Task Termination',
            'Circular Wait',
          ],
          correct_answer: 2,
          explanation: 'The condition is NO preemption; preemption actually breaks deadlocks.',
          citation: 'Section 2.4: "The four Coffman conditions: 1. Mutual Exclusion, 2. Hold and Wait, 3. No Preemption, 4. Circular Wait"',
          difficulty: 'easy',
          order_index: 2,
        })
        .select()
        .single()

      // Question 4: Process Scheduling (Correct answer)
      const { data: q4 } = await supabase
        .from('quiz_questions')
        .insert({
          quiz_id: sampleQuiz.id,
          topic_id: schedTopic?.id || null,
          question: 'What is stored inside a Process Control Block (PCB) to facilitate context switching?',
          options: [
            'Program counter, CPU registers, process state, and memory-management info',
            'Complete file system directory trees and disk head inodes',
            'Only the process identification integer (PID)',
            'The entire operating system kernel code',
          ],
          correct_answer: 0,
          explanation: 'The PCB maintains CPU registers, PC, process state, accounting, and scheduling priority for state restoration.',
          citation: 'Module 1.1: "States (Ready, Running, Waiting, Terminated), Process Control Blocks (PCB), and context switching overhead."',
          difficulty: 'easy',
          order_index: 3,
        })
        .select()
        .single()

      // Insert Student Answers (2 wrong on Virtual Memory, 2 correct on Deadlocks & Scheduling)
      if (q1 && q2 && q3 && q4) {
        await supabase.from('quiz_answers').insert([
          { quiz_id: sampleQuiz.id, question_id: q1.id, user_id: user.id, selected_answer: 0, is_correct: false, time_taken_seconds: 45 },
          { quiz_id: sampleQuiz.id, question_id: q2.id, user_id: user.id, selected_answer: 0, is_correct: false, time_taken_seconds: 38 },
          { quiz_id: sampleQuiz.id, question_id: q3.id, user_id: user.id, selected_answer: 2, is_correct: true, time_taken_seconds: 22 },
          { quiz_id: sampleQuiz.id, question_id: q4.id, user_id: user.id, selected_answer: 0, is_correct: true, time_taken_seconds: 18 },
        ])
      }

      // 5. Create Pre-Diagnosed Gap Report
      if (vmTopic && deadlockTopic && schedTopic) {
        await supabase.from('gap_reports').insert([
          {
            user_id: user.id,
            material_id: syllabusMaterial?.id,
            quiz_id: sampleQuiz.id,
            topic_id: vmTopic.id,
            topic_name: vmTopic.name,
            strength: 'weak',
            score: 0,
            total_questions: 2,
            correct_answers: 0,
            reason: 'Critical misconception in calculating Effective Memory Access Time (EMAT) and diagnosing Thrashing. The student failed to factor in dual memory access latency on TLB miss and confused working set limits with cache invalidation.',
            suggestions: [
              'Review Section 3.2 on EMAT formula derivation: (m + ε) * α + (2m + ε) * (1 - α)',
              'Study Denning\'s Working Set Model and threshold window Δ in demand paging',
              'Practice past midterm question 3 regarding TLB miss penalties',
            ],
          },
          {
            user_id: user.id,
            material_id: syllabusMaterial?.id,
            quiz_id: sampleQuiz.id,
            topic_id: deadlockTopic.id,
            topic_name: deadlockTopic.name,
            strength: 'medium',
            score: 75,
            total_questions: 1,
            correct_answers: 1,
            reason: 'Solid understanding of the four Coffman conditions, but Banker\'s safety state vector calculations have not yet been evaluated under pressure.',
            suggestions: [
              'Execute manual trace of Banker\'s algorithm with 5 processes and 3 resources',
              'Understand safe sequence verification vs resource allocation request algorithm',
            ],
          },
          {
            user_id: user.id,
            material_id: syllabusMaterial?.id,
            quiz_id: sampleQuiz.id,
            topic_id: schedTopic.id,
            topic_name: schedTopic.name,
            strength: 'strong',
            score: 100,
            total_questions: 1,
            correct_answers: 1,
            reason: 'Strong mastery of Process Control Block (PCB) structure, state transitions, and context switching mechanisms.',
            suggestions: [
              'Maintain readiness by briefly reviewing Multi-Level Feedback Queue priority aging',
            ],
          },
        ])

        // Add progress history entries
        await supabase.from('progress_history').insert([
          { user_id: user.id, topic_id: vmTopic.id, topic_name: vmTopic.name, score: 33, strength: 'weak', quiz_id: sampleQuiz.id },
          { user_id: user.id, topic_id: deadlockTopic.id, topic_name: deadlockTopic.name, score: 65, strength: 'medium', quiz_id: sampleQuiz.id },
          { user_id: user.id, topic_id: schedTopic.id, topic_name: schedTopic.name, score: 90, strength: 'strong', quiz_id: sampleQuiz.id },
        ])
      }

      // 6. Create Personalized Revision Plan
      await supabase.from('revision_plans').insert({
        user_id: user.id,
        material_id: syllabusMaterial?.id,
        title: 'Priority Revision Plan: Exam Prep (8 Hours Budget)',
        available_hours: 8,
        status: 'active',
        plan_data: [
          {
            topic_name: 'Virtual Memory & TLB Address Translation',
            priority: 'high',
            estimated_hours: 4.5,
            strength: 'weak',
            completed: false,
            activities: [
              'Derive the EMAT formula step-by-step with 80%, 90%, and 99% TLB hit ratios',
              'Solve 3 numerical problems on multi-level page table lookups and page faults',
              'Diagram the Working Set Window Δ against CPU utilization curve to master thrashing',
            ],
            resources: ['Lecture Notes Section 3.2', 'Midterm 2025 Q3', 'Textbook Chapter 9'],
          },
          {
            topic_name: 'Deadlocks & The Banker\'s Algorithm',
            priority: 'medium',
            estimated_hours: 2.5,
            strength: 'medium',
            completed: false,
            activities: [
              'Run safety sequence matrix check using Allocation, Max, and Need matrices',
              'Compare detection vs prevention trade-offs in distributed lock managers',
            ],
            resources: ['Lecture Notes Section 2.4', 'Midterm 2025 Q2'],
          },
          {
            topic_name: 'Process Management & CPU Scheduling',
            priority: 'low',
            estimated_hours: 1.0,
            strength: 'strong',
            completed: true,
            activities: [
              'Quick 15-minute flashcard review of PCB register restoration',
              'Validate Round Robin quantum selection impact on turnaround time',
            ],
            resources: ['Syllabus Module 1.1 & 1.2'],
          },
        ],
      })
    }

    return NextResponse.json({
      success: true,
      syllabus: syllabusMaterial,
      message: 'Sample syllabus, notes, topic structure, quiz diagnosis, and revision plan seeded successfully!',
    })
  } catch (error) {
    console.error('Seed demo error:', error)
    return NextResponse.json({ error: 'Failed to seed sample demo data' }, { status: 500 })
  }
}
