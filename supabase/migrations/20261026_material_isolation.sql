-- Migration: Material Isolation & Scoped AI Pipeline
-- 1. Add material_id and error_message columns where needed

ALTER TABLE public.materials 
  ADD COLUMN IF NOT EXISTS error_message text;

ALTER TABLE public.quizzes 
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL;

ALTER TABLE public.gap_reports 
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL;

ALTER TABLE public.revision_plans 
  ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL;

-- 2. Add performance indexes on material_id
CREATE INDEX IF NOT EXISTS idx_materials_user_status ON public.materials(user_id, status);
CREATE INDEX IF NOT EXISTS idx_topics_material_id ON public.topics(material_id);
CREATE INDEX IF NOT EXISTS idx_material_chunks_material_id ON public.material_chunks(material_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_material_id ON public.quizzes(material_id);
CREATE INDEX IF NOT EXISTS idx_gap_reports_material_id ON public.gap_reports(material_id);
CREATE INDEX IF NOT EXISTS idx_revision_plans_material_id ON public.revision_plans(material_id);

-- 3. Backfill material_id for existing gap_reports and quizzes from related topics
UPDATE public.gap_reports gr
SET material_id = t.material_id
FROM public.topics t
WHERE gr.topic_id = t.id AND gr.material_id IS NULL AND t.material_id IS NOT NULL;

UPDATE public.quizzes q
SET material_id = sub.material_id
FROM (
  SELECT q2.id, t.material_id
  FROM public.quizzes q2
  JOIN public.topics t ON t.id = q2.topic_ids[1]
  WHERE t.material_id IS NOT NULL
) sub
WHERE q.id = sub.id AND q.material_id IS NULL;

-- 4. Update match_chunks function with optional match_material_id filter
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector,
  match_user_id uuid,
  match_count integer DEFAULT 5,
  match_threshold double precision DEFAULT 0.5,
  match_material_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid,
  material_id uuid,
  content text,
  topic_hint text,
  metadata jsonb,
  similarity double precision
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    material_chunks.id,
    material_chunks.material_id,
    material_chunks.content,
    material_chunks.topic_hint,
    material_chunks.metadata,
    1 - (material_chunks.embedding <=> query_embedding) AS similarity
  FROM public.material_chunks
  WHERE material_chunks.user_id = match_user_id
    AND (match_material_id IS NULL OR material_chunks.material_id = match_material_id)
    AND 1 - (material_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY material_chunks.embedding <=> query_embedding
  LIMIT match_count;
$$;
