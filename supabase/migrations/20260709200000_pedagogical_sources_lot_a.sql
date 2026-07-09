-- ============================================================
-- CapTCF â€” Lot A : bibliothÃ¨que de sources pÃ©dagogiques
-- Stockage, classement manuel, droits et liens avec les sÃ©ances.
-- Pas d'IA, pas de chunks, pas de gÃ©nÃ©ration automatique.
-- ============================================================

BEGIN;

-- Fonction locale de mise à jour updated_at, autonome pour ce lot.
CREATE OR REPLACE FUNCTION public.touch_pedagogical_sources_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$fn$;

-- ------------------------------------------------------------
-- 1. Bucket privÃ© pour les sources pÃ©dagogiques importÃ©es.
-- Les URLs doivent rester signÃ©es et temporaires cÃ´tÃ© application.
-- ------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('pedagogical-sources', 'pedagogical-sources', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "staff_upload_pedagogical_sources_storage" ON storage.objects;
CREATE POLICY "staff_upload_pedagogical_sources_storage"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pedagogical-sources'
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "staff_read_pedagogical_sources_storage" ON storage.objects;
CREATE POLICY "staff_read_pedagogical_sources_storage"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pedagogical-sources'
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "staff_delete_pedagogical_sources_storage" ON storage.objects;
CREATE POLICY "staff_delete_pedagogical_sources_storage"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'pedagogical-sources'
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

-- ------------------------------------------------------------
-- 2. Sources pÃ©dagogiques globales : PDF, DOCX, images, audios,
-- manuels, leÃ§ons, documents authentiques, rÃ©fÃ©rences, etc.
-- Les CHECK sont volontairement lÃ©gers : la typologie Ã©voluera cÃ´tÃ© app.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedagogical_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  source_kind text NOT NULL DEFAULT 'document_authentique',
  source_subtype text,
  pedagogical_domains text[] NOT NULL DEFAULT '{}',
  level_min text CHECK (level_min IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  level_max text CHECK (level_max IN ('A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2')),
  themes text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'imported' CHECK (status IN ('imported', 'analyzing', 'analyzed', 'error')),
  review_status text NOT NULL DEFAULT 'brouillon' CHECK (review_status IN ('brouillon', 'utilisable', 'valide', 'a_remplacer')),
  storage_bucket text NOT NULL DEFAULT 'pedagogical-sources',
  storage_path text NOT NULL,
  file_size integer,
  mime_type text,
  source_origin text,
  rights_status text,
  license_note text,
  reusable_for_students boolean NOT NULL DEFAULT false,
  reusable_for_ai boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedagogical_sources_kind ON public.pedagogical_sources (source_kind);
CREATE INDEX IF NOT EXISTS idx_pedagogical_sources_status ON public.pedagogical_sources (status, review_status);
CREATE INDEX IF NOT EXISTS idx_pedagogical_sources_domains ON public.pedagogical_sources USING gin (pedagogical_domains);
CREATE INDEX IF NOT EXISTS idx_pedagogical_sources_themes ON public.pedagogical_sources USING gin (themes);
CREATE INDEX IF NOT EXISTS idx_pedagogical_sources_created_by ON public.pedagogical_sources (created_by, created_at DESC);

DROP TRIGGER IF EXISTS trg_pedagogical_sources_updated_at ON public.pedagogical_sources;
CREATE TRIGGER trg_pedagogical_sources_updated_at
  BEFORE UPDATE ON public.pedagogical_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();

ALTER TABLE public.pedagogical_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_pedagogical_sources" ON public.pedagogical_sources;
CREATE POLICY "staff_read_pedagogical_sources"
  ON public.pedagogical_sources FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_insert_pedagogical_sources" ON public.pedagogical_sources;
CREATE POLICY "staff_insert_pedagogical_sources"
  ON public.pedagogical_sources FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "staff_update_own_pedagogical_sources" ON public.pedagogical_sources;
CREATE POLICY "staff_update_own_pedagogical_sources"
  ON public.pedagogical_sources FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_delete_own_pedagogical_sources" ON public.pedagogical_sources;
CREATE POLICY "staff_delete_own_pedagogical_sources"
  ON public.pedagogical_sources FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_all_pedagogical_sources" ON public.pedagogical_sources;
CREATE POLICY "service_all_pedagogical_sources"
  ON public.pedagogical_sources FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ------------------------------------------------------------
-- 3. Sources liÃ©es Ã  une sÃ©ance comme cadrage ou appui.
-- SÃ©parÃ© de session_document_links pour ne pas confondre :
-- - dÃ©roulÃ©/livret : session_document_links
-- - mÃ©moire/source de contexte : session_pedagogical_sources
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_pedagogical_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  source_id uuid NOT NULL REFERENCES public.pedagogical_sources(id) ON DELETE CASCADE,
  usage_scope text NOT NULL DEFAULT 'context_ia',
  priority integer NOT NULL DEFAULT 100,
  notes text,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_code, source_id, usage_scope)
);

CREATE INDEX IF NOT EXISTS idx_session_pedagogical_sources_session
  ON public.session_pedagogical_sources (session_code, priority, created_at);

CREATE INDEX IF NOT EXISTS idx_session_pedagogical_sources_source
  ON public.session_pedagogical_sources (source_id);

DROP TRIGGER IF EXISTS trg_session_pedagogical_sources_updated_at ON public.session_pedagogical_sources;
CREATE TRIGGER trg_session_pedagogical_sources_updated_at
  BEFORE UPDATE ON public.session_pedagogical_sources
  FOR EACH ROW EXECUTE FUNCTION public.touch_pedagogical_sources_updated_at();

ALTER TABLE public.session_pedagogical_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_session_pedagogical_sources" ON public.session_pedagogical_sources;
CREATE POLICY "staff_read_session_pedagogical_sources"
  ON public.session_pedagogical_sources FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_insert_session_pedagogical_sources" ON public.session_pedagogical_sources;
CREATE POLICY "staff_insert_session_pedagogical_sources"
  ON public.session_pedagogical_sources FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

DROP POLICY IF EXISTS "staff_update_own_session_pedagogical_sources" ON public.session_pedagogical_sources;
CREATE POLICY "staff_update_own_session_pedagogical_sources"
  ON public.session_pedagogical_sources FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_delete_own_session_pedagogical_sources" ON public.session_pedagogical_sources;
CREATE POLICY "staff_delete_own_session_pedagogical_sources"
  ON public.session_pedagogical_sources FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_all_session_pedagogical_sources" ON public.session_pedagogical_sources;
CREATE POLICY "service_all_session_pedagogical_sources"
  ON public.session_pedagogical_sources FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
