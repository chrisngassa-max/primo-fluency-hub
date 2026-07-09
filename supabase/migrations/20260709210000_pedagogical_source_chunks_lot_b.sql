-- ============================================================
-- CapTCF - Lot B : analyse des sources pedagogiques
-- Extraction en morceaux reutilisables par l'IA et les futurs moteurs.
-- Pas de generation d'exercices dans ce lot.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.pedagogical_source_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.pedagogical_sources(id) ON DELETE CASCADE,
  chunk_type text NOT NULL DEFAULT 'extrait'
    CHECK (chunk_type IN (
      'resume',
      'extrait',
      'lecon',
      'consigne',
      'exercice',
      'corrige',
      'vocabulaire',
      'grammaire',
      'conjugaison',
      'phonetique',
      'civique',
      'image_description',
      'metadata'
    )),
  title text,
  content_text text NOT NULL,
  page_start integer,
  page_end integer,
  level text CHECK (level IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  domains text[] NOT NULL DEFAULT '{}',
  theme text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_source_chunks_source
  ON public.pedagogical_source_chunks (source_id, created_at);

CREATE INDEX IF NOT EXISTS idx_pedagogical_source_chunks_type
  ON public.pedagogical_source_chunks (chunk_type);

CREATE INDEX IF NOT EXISTS idx_pedagogical_source_chunks_level
  ON public.pedagogical_source_chunks (level);

CREATE INDEX IF NOT EXISTS idx_pedagogical_source_chunks_domains
  ON public.pedagogical_source_chunks USING gin (domains);

CREATE INDEX IF NOT EXISTS idx_pedagogical_source_chunks_search
  ON public.pedagogical_source_chunks
  USING gin (to_tsvector('french', coalesce(title, '') || ' ' || content_text));

DROP TRIGGER IF EXISTS trg_pedagogical_source_chunks_updated_at ON public.pedagogical_source_chunks;
CREATE TRIGGER trg_pedagogical_source_chunks_updated_at
  BEFORE UPDATE ON public.pedagogical_source_chunks
  FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();

ALTER TABLE public.pedagogical_source_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_pedagogical_source_chunks" ON public.pedagogical_source_chunks;
CREATE POLICY "staff_read_pedagogical_source_chunks"
  ON public.pedagogical_source_chunks FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_insert_pedagogical_source_chunks" ON public.pedagogical_source_chunks;
CREATE POLICY "staff_insert_pedagogical_source_chunks"
  ON public.pedagogical_source_chunks FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_update_pedagogical_source_chunks" ON public.pedagogical_source_chunks;
CREATE POLICY "staff_update_pedagogical_source_chunks"
  ON public.pedagogical_source_chunks FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_delete_pedagogical_source_chunks" ON public.pedagogical_source_chunks;
CREATE POLICY "staff_delete_pedagogical_source_chunks"
  ON public.pedagogical_source_chunks FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_all_pedagogical_source_chunks" ON public.pedagogical_source_chunks;
CREATE POLICY "service_all_pedagogical_source_chunks"
  ON public.pedagogical_source_chunks FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
