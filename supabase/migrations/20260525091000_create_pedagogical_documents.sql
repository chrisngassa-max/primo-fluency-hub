-- Metadonnees des PDF sources et journal des extractions non exploitables.
-- Ces tables completent public.pedagogical_activities sans imposer d'ordre
-- d'import strict entre documents et activites.

CREATE TABLE IF NOT EXISTS public.pedagogical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id text NOT NULL UNIQUE,
  file_name text NOT NULL,
  title text NOT NULL,
  document_type text,
  audience text,
  levels text[] NOT NULL DEFAULT '{}',
  short_summary text NOT NULL DEFAULT '',
  activity_count integer NOT NULL DEFAULT 0 CHECK (activity_count >= 0),
  markdown_file text,
  source_kind text NOT NULL DEFAULT 'pdf_extraction',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_documents_file_name
  ON public.pedagogical_documents (file_name);

CREATE INDEX IF NOT EXISTS idx_pedagogical_documents_document_type
  ON public.pedagogical_documents (document_type);

CREATE INDEX IF NOT EXISTS idx_pedagogical_documents_levels
  ON public.pedagogical_documents USING gin (levels);

CREATE INDEX IF NOT EXISTS idx_pedagogical_documents_search
  ON public.pedagogical_documents USING gin (
    to_tsvector(
      'french',
      coalesce(title, '') || ' ' ||
      coalesce(document_type, '') || ' ' ||
      coalesce(audience, '') || ' ' ||
      coalesce(short_summary, '') || ' ' ||
      array_to_string(levels, ' ')
    )
  );

CREATE TABLE IF NOT EXISTS public.pedagogical_extraction_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL UNIQUE,
  error text NOT NULL,
  source_kind text NOT NULL DEFAULT 'pdf_extraction',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_extraction_errors_file_name
  ON public.pedagogical_extraction_errors (file_name);

CREATE OR REPLACE FUNCTION public.touch_pedagogical_documents_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedagogical_documents_updated_at
  ON public.pedagogical_documents;

CREATE TRIGGER trg_pedagogical_documents_updated_at
  BEFORE UPDATE ON public.pedagogical_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pedagogical_documents_updated_at();

DROP TRIGGER IF EXISTS trg_pedagogical_extraction_errors_updated_at
  ON public.pedagogical_extraction_errors;

CREATE TRIGGER trg_pedagogical_extraction_errors_updated_at
  BEFORE UPDATE ON public.pedagogical_extraction_errors
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pedagogical_documents_updated_at();

ALTER TABLE public.pedagogical_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedagogical_extraction_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedagogical_documents_select_all"
  ON public.pedagogical_documents;

CREATE POLICY "pedagogical_documents_select_all"
  ON public.pedagogical_documents
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "pedagogical_extraction_errors_select_all"
  ON public.pedagogical_extraction_errors;

CREATE POLICY "pedagogical_extraction_errors_select_all"
  ON public.pedagogical_extraction_errors
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.search_pedagogical_documents(
  p_query text DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_document_type text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.pedagogical_documents
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT CASE
      WHEN p_query IS NULL OR btrim(p_query) = '' THEN NULL
      ELSE plainto_tsquery('french', p_query)
    END AS ts_query
  )
  SELECT d.*
  FROM public.pedagogical_documents d
  CROSS JOIN params p
  WHERE (p.ts_query IS NULL OR to_tsvector(
      'french',
      coalesce(d.title, '') || ' ' ||
      coalesce(d.document_type, '') || ' ' ||
      coalesce(d.audience, '') || ' ' ||
      coalesce(d.short_summary, '') || ' ' ||
      array_to_string(d.levels, ' ')
    ) @@ p.ts_query)
    AND (p_level IS NULL OR d.levels @> ARRAY[p_level])
    AND (p_document_type IS NULL OR d.document_type = p_document_type)
  ORDER BY
    CASE WHEN p.ts_query IS NULL THEN 0 ELSE ts_rank(
      to_tsvector(
        'french',
        coalesce(d.title, '') || ' ' ||
        coalesce(d.document_type, '') || ' ' ||
        coalesce(d.audience, '') || ' ' ||
        coalesce(d.short_summary, '') || ' ' ||
        array_to_string(d.levels, ' ')
      ),
      p.ts_query
    ) END DESC,
    d.activity_count DESC,
    d.title
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;

GRANT EXECUTE ON FUNCTION public.search_pedagogical_documents(
  text,
  text,
  text,
  integer
) TO anon, authenticated;
