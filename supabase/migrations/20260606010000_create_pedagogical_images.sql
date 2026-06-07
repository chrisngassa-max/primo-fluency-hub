-- Banque d'images pedagogiques controlees pour les exercices TCF / FLE.
-- Les images sont stockees dans le bucket public `pedagogical-images` et
-- referencees en base pour eviter les images aleatoires dans les generateurs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('pedagogical-images', 'pedagogical-images', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

CREATE TABLE IF NOT EXISTS public.pedagogical_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_key text NOT NULL UNIQUE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  alt_text text NOT NULL DEFAULT '',
  image_url text,
  source_url text,
  source text,
  license text,
  attribution text,
  author text,
  storage_bucket text NOT NULL DEFAULT 'pedagogical-images',
  storage_path text NOT NULL,
  public_url text,
  level_tags text[] NOT NULL DEFAULT '{}',
  skill_tags text[] NOT NULL DEFAULT '{}',
  theme_tags text[] NOT NULL DEFAULT '{}',
  pedagogical_tags text[] NOT NULL DEFAULT '{}',
  language_level text,
  recommended_exercise_types text[] NOT NULL DEFAULT '{}',
  quality_score integer CHECK (quality_score IS NULL OR quality_score BETWEEN 0 AND 5),
  pedagogical_relevance_score integer CHECK (
    pedagogical_relevance_score IS NULL OR pedagogical_relevance_score BETWEEN 0 AND 5
  ),
  rejected boolean NOT NULL DEFAULT false,
  rejection_reason text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_images_levels
  ON public.pedagogical_images USING gin (level_tags);

CREATE INDEX IF NOT EXISTS idx_pedagogical_images_skills
  ON public.pedagogical_images USING gin (skill_tags);

CREATE INDEX IF NOT EXISTS idx_pedagogical_images_themes
  ON public.pedagogical_images USING gin (theme_tags);

CREATE INDEX IF NOT EXISTS idx_pedagogical_images_active
  ON public.pedagogical_images (is_active, rejected);

CREATE OR REPLACE FUNCTION public.touch_pedagogical_images_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pedagogical_images_updated_at
  ON public.pedagogical_images;

CREATE TRIGGER trg_pedagogical_images_updated_at
  BEFORE UPDATE ON public.pedagogical_images
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_pedagogical_images_updated_at();

ALTER TABLE public.pedagogical_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pedagogical_images_select_active" ON public.pedagogical_images;
CREATE POLICY "pedagogical_images_select_active"
  ON public.pedagogical_images
  FOR SELECT
  USING (is_active = true AND rejected = false);

DROP POLICY IF EXISTS "Pedagogical images are publicly accessible" ON storage.objects;
CREATE POLICY "Pedagogical images are publicly accessible"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'pedagogical-images');

DROP POLICY IF EXISTS "Service role can upload pedagogical images" ON storage.objects;
CREATE POLICY "Service role can upload pedagogical images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'pedagogical-images');

DROP POLICY IF EXISTS "Service role can update pedagogical images" ON storage.objects;
CREATE POLICY "Service role can update pedagogical images"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'pedagogical-images');

CREATE OR REPLACE FUNCTION public.search_pedagogical_images(
  p_query text DEFAULT NULL,
  p_level text DEFAULT NULL,
  p_skill text DEFAULT NULL,
  p_theme text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS SETOF public.pedagogical_images
LANGUAGE sql
STABLE
AS $$
  WITH params AS (
    SELECT CASE
      WHEN p_query IS NULL OR btrim(p_query) = '' THEN NULL
      ELSE plainto_tsquery('french', p_query)
    END AS ts_query
  )
  SELECT img.*
  FROM public.pedagogical_images img
  CROSS JOIN params p
  WHERE img.is_active = true
    AND img.rejected = false
    AND (p_level IS NULL OR img.level_tags @> ARRAY[p_level])
    AND (p_skill IS NULL OR img.skill_tags @> ARRAY[p_skill])
    AND (p_theme IS NULL OR img.theme_tags @> ARRAY[p_theme])
    AND (p.ts_query IS NULL OR to_tsvector(
      'french',
      coalesce(img.title, '') || ' ' ||
      coalesce(img.description, '') || ' ' ||
      coalesce(img.alt_text, '') || ' ' ||
      coalesce(img.language_level, '') || ' ' ||
      array_to_string(img.level_tags, ' ') || ' ' ||
      array_to_string(img.skill_tags, ' ') || ' ' ||
      array_to_string(img.theme_tags, ' ') || ' ' ||
      array_to_string(img.pedagogical_tags, ' ')
    ) @@ p.ts_query)
  ORDER BY
    img.pedagogical_relevance_score DESC NULLS LAST,
    img.quality_score DESC NULLS LAST,
    img.title
  LIMIT greatest(1, least(coalesce(p_limit, 20), 100));
$$;

GRANT EXECUTE ON FUNCTION public.search_pedagogical_images(
  text,
  text,
  text,
  text,
  integer
) TO anon, authenticated;
