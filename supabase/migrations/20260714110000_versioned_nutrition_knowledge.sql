-- Version-aware, full-text retrieval for nutrition guidance. Publishing is a
-- service-role/admin workflow; authenticated customers can only read current
-- published material.

CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  publisher TEXT NOT NULL,
  source_url TEXT NOT NULL,
  version TEXT NOT NULL,
  effective_from DATE NOT NULL,
  effective_to DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'retired')),
  content_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_url, version)
);

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.knowledge_documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL CHECK (chunk_index >= 0),
  heading TEXT,
  content TEXT NOT NULL CHECK (LENGTH(content) BETWEEN 20 AND 12000),
  token_count INTEGER CHECK (token_count IS NULL OR token_count > 0),
  search_vector TSVECTOR GENERATED ALWAYS AS (
    to_tsvector('english', COALESCE(heading, '') || ' ' || content)
  ) STORED,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (document_id, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_documents_effective
  ON public.knowledge_documents (status, effective_from, effective_to);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_search
  ON public.knowledge_chunks USING GIN (search_vector);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users read published knowledge" ON public.knowledge_documents;
CREATE POLICY "Authenticated users read published knowledge"
ON public.knowledge_documents FOR SELECT TO authenticated
USING (
  status = 'published'
  AND effective_from <= CURRENT_DATE
  AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
);

DROP POLICY IF EXISTS "Authenticated users read published knowledge chunks" ON public.knowledge_chunks;
CREATE POLICY "Authenticated users read published knowledge chunks"
ON public.knowledge_chunks FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents document
    WHERE document.id = knowledge_chunks.document_id
      AND document.status = 'published'
      AND document.effective_from <= CURRENT_DATE
      AND (document.effective_to IS NULL OR document.effective_to >= CURRENT_DATE)
  )
);

CREATE OR REPLACE FUNCTION public.search_nutrition_knowledge(
  p_query TEXT,
  p_as_of DATE DEFAULT CURRENT_DATE,
  p_limit INTEGER DEFAULT 5
)
RETURNS TABLE (
  chunk_id UUID,
  document_id UUID,
  title TEXT,
  publisher TEXT,
  source_url TEXT,
  version TEXT,
  effective_from DATE,
  heading TEXT,
  content TEXT,
  rank REAL
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH query AS (
    SELECT websearch_to_tsquery('english', LEFT(COALESCE(p_query, ''), 500)) AS value
  )
  SELECT
    chunk.id,
    document.id,
    document.title,
    document.publisher,
    document.source_url,
    document.version,
    document.effective_from,
    chunk.heading,
    chunk.content,
    ts_rank_cd(chunk.search_vector, query.value)::REAL
  FROM public.knowledge_chunks chunk
  JOIN public.knowledge_documents document ON document.id = chunk.document_id
  CROSS JOIN query
  WHERE document.status = 'published'
    AND document.effective_from <= p_as_of
    AND (document.effective_to IS NULL OR document.effective_to >= p_as_of)
    AND chunk.search_vector @@ query.value
  ORDER BY ts_rank_cd(chunk.search_vector, query.value) DESC, document.effective_from DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 5), 1), 10);
$$;

GRANT EXECUTE ON FUNCTION public.search_nutrition_knowledge(TEXT, DATE, INTEGER) TO authenticated;
