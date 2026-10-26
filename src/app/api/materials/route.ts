import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { chunkText, extractTopics } from '@/lib/rag'
import { generateEmbedding } from '@/lib/gemini'

// Strip null bytes and non-printable control characters that PostgreSQL rejects
function sanitizeText(str: string): string {
  if (!str) return ''
  return str
    .replace(/\0/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .trim()
}

async function extractTextFromFile(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name.toLowerCase()

  if (fileName.endsWith('.pdf')) {
    try {
      const { PDFParse } = await import('pdf-parse')
      const parser = new (PDFParse as any)({ data: buffer })
      const result = await parser.getText()
      if (result && result.text) {
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
        .map(m => m.replace(/^\(|\)\s*Tj$/g, ''))
        .filter(t => t.length > 2)
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
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

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

      // Try uploading to Supabase Storage, but don't block DB save if storage bucket is restricted
      try {
        const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
        const filePath = `${user.id}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase.storage
          .from('materials')
          .upload(filePath, file)

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from('materials')
            .getPublicUrl(filePath)
          fileUrl = urlData?.publicUrl || null
        } else {
          console.warn('Supabase storage upload notice (continuing with DB save):', uploadError.message)
        }
      } catch (storageErr) {
        console.warn('Supabase storage upload exception (continuing with DB save):', storageErr)
      }
    }

    // Always sanitize text content before database insert
    textContent = sanitizeText(textContent)

    if (!textContent || textContent.length < 5) {
      return NextResponse.json({
        error: 'Could not extract readable text from this document. Please paste the syllabus or notes text directly in the box below.'
      }, { status: 400 })
    }

    // Create material record
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
      })
      .select()
      .single()

    if (materialError) {
      console.error('Material save error details:', materialError)
      return NextResponse.json({
        error: `Failed to save material: ${materialError.message || 'Database error'}`
      }, { status: 500 })
    }

    // Process in background: chunk, embed, and extract topics
    processInBackground(supabase, user.id, material.id, textContent, type)

    return NextResponse.json({ material })
  } catch (error: any) {
    console.error('Material upload error:', error)
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 })
  }
}

async function processInBackground(
  supabase: any,
  userId: string,
  materialId: string,
  text: string,
  type: string
) {
  try {
    // 1. Chunk the text
    const chunks = chunkText(text)

    // 2. Generate embeddings and store chunks
    for (let i = 0; i < chunks.length; i++) {
      try {
        const embedding = await generateEmbedding(chunks[i])

        await supabase.from('material_chunks').insert({
          material_id: materialId,
          user_id: userId,
          content: sanitizeText(chunks[i]),
          chunk_index: i,
          embedding,
          metadata: { type, chunk_length: chunks[i].length },
        })
      } catch (embError) {
        console.error(`Error processing chunk ${i}:`, embError)
        // Continue processing other chunks
      }

      // Rate limiting for Gemini API
      if (i > 0 && i % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // 3. Extract topics if this is a syllabus
    if (type === 'syllabus') {
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
            })
            .select()
            .single()

          if (parentTopic && topics[i].subtopics) {
            for (let j = 0; j < topics[i].subtopics.length; j++) {
              await supabase.from('topics').insert({
                user_id: userId,
                material_id: materialId,
                name: topics[i].subtopics[j].name,
                description: topics[i].subtopics[j].description,
                parent_topic_id: parentTopic.id,
                order_index: j,
              })
            }
          }
        }
      } catch (topicError) {
        console.error('Topic extraction error:', topicError)
      }
    }

    // 4. Mark material as ready
    await supabase
      .from('materials')
      .update({ status: 'ready' })
      .eq('id', materialId)

  } catch (error) {
    console.error('Background processing error:', error)
    await supabase
      .from('materials')
      .update({ status: 'error' })
      .eq('id', materialId)
  }
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

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

    return NextResponse.json({ materials })
  } catch (error) {
    console.error('Materials fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await request.json()

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
