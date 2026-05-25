-- Referentiel d'activites FLE extraites des PDF pedagogiques Wilson.
-- Objectif : rendre la banque consultable en base par categorie, niveau,
-- duree, tags et source PDF, sans dependance a une memoire agent.

CREATE TABLE IF NOT EXISTS public.pedagogical_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_key text NOT NULL UNIQUE,
  activity_id text NOT NULL,
  title text NOT NULL,
  category text NOT NULL,
  audience text,
  level_min text NOT NULL,
  level_max text NOT NULL,
  level_min_rank smallint GENERATED ALWAYS AS (
    CASE level_min
      WHEN 'Pré-A1' THEN -1
      WHEN 'Pre-A1' THEN -1
      WHEN 'A0' THEN 0
      WHEN 'A1' THEN 1
      WHEN 'A2' THEN 2
      WHEN 'B1' THEN 3
      WHEN 'B2' THEN 4
      WHEN 'C1' THEN 5
      WHEN 'C2' THEN 6
      ELSE NULL
    END
  ) STORED,
  level_max_rank smallint GENERATED ALWAYS AS (
    CASE level_max
      WHEN 'Pré-A1' THEN -1
      WHEN 'Pre-A1' THEN -1
      WHEN 'A0' THEN 0
      WHEN 'A1' THEN 1
      WHEN 'A2' THEN 2
      WHEN 'B1' THEN 3
      WHEN 'B2' THEN 4
      WHEN 'C1' THEN 5
      WHEN 'C2' THEN 6
      ELSE NULL
    END
  ) STORED,
  objective text NOT NULL DEFAULT '',
  duration_min integer CHECK (duration_min IS NULL OR duration_min >= 0),
  duration_max integer CHECK (duration_max IS NULL OR duration_max >= 0),
  materials_needed text[] NOT NULL DEFAULT '{}',
  instructions text NOT NULL DEFAULT '',
  tags text[] NOT NULL DEFAULT '{}',
  document_id text,
  source_pdf text,
  source_kind text NOT NULL DEFAULT 'pdf_extraction',
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedagogical_activities_level_min_check
    CHECK (level_min IN ('Pré-A1', 'Pre-A1', 'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT pedagogical_activities_level_max_check
    CHECK (level_max IN ('Pré-A1', 'Pre-A1', 'A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  CONSTRAINT pedagogical_activities_level_order_check
    CHECK (level_min_rank IS NOT NULL AND level_max_rank IS NOT NULL AND level_min_rank <= level_max_rank),
  CONSTRAINT pedagogical_activities_duration_order_check
    CHECK (duration_min IS NULL OR duration_max IS NULL OR duration_min <= duration_max)
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_category
  ON public.pedagogical_activities (category);

CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_activity_id
  ON public.pedagogical_activities (activity_id);

CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_levels
  ON public.pedagogical_activities (level_min_rank, level_max_rank);

CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_duration
  ON public.pedagogical_activities (duration_min, duration_max);

CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_tags
  ON public.pedagogical_activities USING gin (tags);

CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_source_pdf
  ON public.pedagogical_activities (source_pdf);

CREATE INDEX IF NOT EXISTS idx_pedagogical_activities_search
  ON public.pedagogical_activities USING gin (
    to_tsvector(
      'french',
      coalesce(title, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(objective, '') || ' ' ||
      coalesce(instructions, '') || ' ' ||
      array_to_string(tags, ' ')
    )
  );

CREATE OR REPLACE FUNCTION public.touch_pedagogical_activities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedagogical_activities_updated_at
  ON public.pedagogical_activities;

CREATE TRIGGER trg_pedagogical_activities_updated_at
  BEFORE UPDATE ON public.pedagogical_activities
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pedagogical_activities_updated_at();

ALTER TABLE public.pedagogical_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedagogical_activities_select_all"
  ON public.pedagogical_activities;

CREATE POLICY "pedagogical_activities_select_all"
  ON public.pedagogical_activities
  FOR SELECT
  USING (true);

CREATE OR REPLACE FUNCTION public.search_pedagogical_activities(
  p_query text DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_max_duration integer DEFAULT NULL,
  p_tags text[] DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.pedagogical_activities
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT
      CASE p_level
        WHEN 'Pré-A1' THEN -1
        WHEN 'Pre-A1' THEN -1
        WHEN 'A0' THEN 0
        WHEN 'A1' THEN 1
        WHEN 'A2' THEN 2
        WHEN 'B1' THEN 3
        WHEN 'B2' THEN 4
        WHEN 'C1' THEN 5
        WHEN 'C2' THEN 6
        ELSE NULL
      END AS level_rank,
      CASE
        WHEN p_query IS NULL OR btrim(p_query) = '' THEN NULL
        ELSE plainto_tsquery('french', p_query)
      END AS ts_query
  )
  SELECT a.*
  FROM public.pedagogical_activities a
  CROSS JOIN params p
  WHERE (p.ts_query IS NULL OR to_tsvector(
      'french',
      coalesce(a.title, '') || ' ' ||
      coalesce(a.category, '') || ' ' ||
      coalesce(a.objective, '') || ' ' ||
      coalesce(a.instructions, '') || ' ' ||
      array_to_string(a.tags, ' ')
    ) @@ p.ts_query)
    AND (p.level_rank IS NULL OR p.level_rank BETWEEN a.level_min_rank AND a.level_max_rank)
    AND (p_category IS NULL OR a.category = p_category)
    AND (p_max_duration IS NULL OR a.duration_max IS NULL OR a.duration_max <= p_max_duration)
    AND (p_tags IS NULL OR cardinality(p_tags) = 0 OR a.tags && p_tags)
  ORDER BY
    CASE WHEN p.ts_query IS NULL THEN 0 ELSE ts_rank(
      to_tsvector(
        'french',
        coalesce(a.title, '') || ' ' ||
        coalesce(a.category, '') || ' ' ||
        coalesce(a.objective, '') || ' ' ||
        coalesce(a.instructions, '') || ' ' ||
        array_to_string(a.tags, ' ')
      ),
      p.ts_query
    ) END DESC,
    a.level_min_rank,
    a.duration_min NULLS LAST,
    a.title
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;

GRANT EXECUTE ON FUNCTION public.search_pedagogical_activities(
  text,
  text,
  text,
  integer,
  text[],
  integer
) TO anon, authenticated;
