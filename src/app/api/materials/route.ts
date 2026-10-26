import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chunkText, extractTopics } from '@/lib/rag'
import { generateEmbedding } from '@/lib/gemini'

// Allow Vercel maximum execution duration
export const maxDuration = 60

// Strip null bytes and non-printable control characters that PostgreSQL rejects
function sanitizeText(str: string): string {
  if (!str) return ''
  return str
    .replace(/\0/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
}

async function extractTextFromFile(file: File): Promise<string> {
  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const fileName = file.name.toLowerCase()

    if (fileName.endsWith('.pdf')) {
      try {
        const { PDFParse } = await import('pdf-parse')
        const parser = new (PDFParse as any)({ data: buffer })
        const result = await Promise.race([
          parser.getText(),
          new Promise<any>((_, reject) =>
            setTimeout(() => reject(new Error('PDFParse timeout')), 3500)
          ),
        ])
        if (result && result.text && result.text.trim().length > 20) {
          return sanitizeText(result.text)
        }
      } catch (pdfErr) {
        console.warn('PDFParse notice, using stream extractor fallback:', pdfErr)
      }

      // Fallback: extract printable text streams from PDF buffer
      const raw = buffer.toString('latin1')
      const textMatches = raw.match(/\(([^)]+)\)\s*Tj/g) || []
      if (textMatches.length > 0) {
        const extracted = textMatches
          .map((m) => m.replace(/^\(|\)\s*Tj$/g, ''))
          .filter((t) => t.length > 2)
          .join(' ')
        if (extracted.trim().length > 20) {
          return sanitizeText(extracted)
        }
      }

      // Secondary fallback: clean plain-text strings from PDF
      const textOnly = raw
        .replace(/[^\x20-\x7E\t\n\r]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      return sanitizeText(textOnly.slice(0, 50000))
    }

    // Text, markdown, or plain text file
    const text = new TextDecoder('utf-8', { fatal: false }).decode(buffer)
    return sanitizeText(text)
  } catch (err) {
    console.warn('extractTextFromFile general exception:', err)
    return ''
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized. Please log in first.' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const type = formData.get('type') as string
    const rawText = formData.get('rawText') as string | null

    let textContent = rawText || ''
    let fileName = 'text-input.txt'
    let fileUrl: string | null = null

    // Handle file upload
    if (file) {
      fileName = file.name
      try {
        const extracted = await extractTextFromFile(file)
        if (extracted) {
          textContent = extracted
        }
      } catch (extractErr) {
        console.warn('Text extraction fallback triggered:', extractErr)
      }

      // Upload to Supabase Storage with timeout protection (never blocks DB save)
      try {
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${user.id}/${Date.now()}-${safeName}`
        
        const storagePromise = supabase.storage.from('materials').upload(filePath, file)
        const timeoutPromise = new Promise<{ error: Error }>((resolve) =>
          setTimeout(() => resolve({ error: new Error('Storage timeout') }), 2500)
        )

        const { error: uploadError } = await Promise.race([storagePromise, timeoutPromise])

        if (!uploadError) {
          const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath)
          fileUrl = urlData?.publicUrl || null
        }
      } catch (storageErr) {
        console.warn('Supabase storage upload notice:', storageErr)
      }
    }

    // Always sanitize text content before database insert
    textContent = sanitizeText(textContent)

    if (!textContent || textContent.length < 5) {
      return NextResponse.json(
        {
          error:
            'Could not extract readable text from this document. Please paste the syllabus or notes text directly in the box below.',
        },
        { status: 400 }
      )
    }

    // Create material record with initial 'processing' status
    const { data: material, error: materialError } = await supabase
      .from('materials')
      .insert({
        user_id: user.id,
        title: title ? title.trim() : fileName,
        type: ['syllabus', 'notes', 'textbook', 'question_paper'].includes(type) ? type : 'notes',
        file_name: fileName,
        file_url: fileUrl,
        raw_text: textContent,
        status: 'processing',
        error_message: null,
      })
      .select()
      .single()

    if (materialError) {
      console.error('Material save error details:', materialError)
      return NextResponse.json(
        { error: `Failed to save material: ${materialError.message || 'Database error'}` },
        { status: 500 }
      )
    }

    // Process chunking, embeddings, and topic extraction synchronously with 60s timeout protection
    let topicsCount = 0
    let chunksCount = 0
    try {
      const result = await processMaterial(supabase, user.id, material.id, textContent, type)
      topicsCount = result.topicsCount
      chunksCount = result.chunksCount

      await supabase
        .from('materials')
        .update({ status: 'ready', error_message: null })
        .eq('id', material.id)
    } catch (procErr: any) {
      console.error('Material processing error:', procErr)
      await supabase
        .from('materials')
        .update({
          status: 'failed',
          error_message: procErr?.message || 'Failed during text chunking or topic extraction',
        })
        .eq('id', material.id)

      return NextResponse.json(
        { error: `Processing error: ${procErr?.message || 'Could not process material'}` },
        { status: 500 }
      )
    }

    // Refetch the updated material record
    const { data: updatedMaterial } = await supabase
      .from('materials')
      .select('*')
      .eq('id', material.id)
      .single()

    return NextResponse.json({
      material: updatedMaterial || { ...material, status: 'ready' },
      topicsCount,
      chunksCount,
    })
  } catch (error: any) {
    console.error('Material upload error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

async function processMaterial(
  supabase: any,
  userId: string,
  materialId: string,
  text: string,
  type: string
): Promise<{ chunksCount: number; topicsCount: number }> {
  // 1. Chunk the text
  const chunks = chunkText(text)
  let chunksCount = 0

  // 2. Generate embeddings and store chunks in parallel batches of 4
  const BATCH_SIZE = 4
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (chunk, batchIdx) => {
        const chunkIdx = i + batchIdx
        try {
          const embedding = await generateEmbedding(chunk)
          await supabase.from('material_chunks').insert({
            material_id: materialId,
            user_id: userId,
            content: sanitizeText(chunk),
            chunk_index: chunkIdx,
            embedding,
            metadata: { type, chunk_length: chunk.length },
          })
          chunksCount++
        } catch (embError) {
          console.error(`Error processing chunk ${chunkIdx}:`, embError)
        }
      })
    )
  }

  // 3. Extract topics specifically for this material (regardless of type: syllabus, notes, textbook)
  let topicsCount = 0
  try {
    const topics = await extractTopics(text)

    for (let i = 0; i < topics.length; i++) {
      const { data: parentTopic } = await supabase
        .from('topics')
        .insert({
          user_id: userId,
          material_id: materialId,
          name: topics[i].name,
          description: topics[i].description,
          order_index: i,
          strength: 'untested',
          score: 0,
        })
        .select()
        .single()

      if (parentTopic) {
        topicsCount++
        if (topics[i].subtopics && topics[i].subtopics.length > 0) {
          for (let j = 0; j < topics[i].subtopics.length; j++) {
            await supabase.from('topics').insert({
              user_id: userId,
              material_id: materialId,
              name: topics[i].subtopics[j].name,
              description: topics[i].subtopics[j].description,
              parent_topic_id: parentTopic.id,
              order_index: j,
              strength: 'untested',
              score: 0,
            })
            topicsCount++
          }
        }
      }
    }
  } catch (topicError) {
    console.error('Topic extraction error:', topicError)
  }

  return { chunksCount, topicsCount }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: materials, error } = await supabase
      .from('materials')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ materials: materials || [] })
  } catch (error) {
    console.error('Materials fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()
    if (!id) {
      return NextResponse.json({ error: 'Material id is required' }, { status: 400 })
    }

    // Verify ownership
    const { data: material } = await supabase
      .from('materials')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!material) {
      return NextResponse.json({ error: 'Material not found or access denied' }, { status: 404 })
    }

    // Clean up dependent resources for this material
    await Promise.all([
      supabase.from('material_chunks').delete().eq('material_id', id).eq('user_id', user.id),
      supabase.from('topics').delete().eq('material_id', id).eq('user_id', user.id),
      supabase.from('gap_reports').delete().eq('material_id', id).eq('user_id', user.id),
      supabase.from('quizzes').delete().eq('material_id', id).eq('user_id', user.id),
      supabase.from('revision_plans').delete().eq('material_id', id).eq('user_id', user.id),
    ])

    const { error } = await supabase
      .from('materials')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Material delete error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
