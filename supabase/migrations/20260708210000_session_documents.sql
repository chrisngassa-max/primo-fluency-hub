-- ============================================================
-- CapTCF — Documents de séance éditables (MVP)
-- Table complémentaire, additive, sans impact sur training_sessions,
-- session_resources ni le pipeline de génération/publication existant.
-- Objectif : brouillons pédagogiques lisibles/modifiables en direct
-- par le formateur, distincts des ressources publiées par le pipeline.
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.session_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Pas de FK vers training_sessions(code) : code seul n'est pas unique
  -- (UNIQUE (plan_version_id, code) uniquement). Même convention que
  -- invariant_supports.session_code (texte libre + index).
  session_code text NOT NULL,
  document_type text NOT NULL CHECK (document_type IN (
    'fiche_formateur',
    'fiche_apprenant',
    'dialogue_transcription',
    'audio_mp3',
    'qcm_tcf',
    'qcm_civique',
    'corrige_formateur',
    'lexique',
    'support_visuel',
    'document_transforme',
    'document_importe',
    'exercice_interactif'
  )),
  title text NOT NULL,
  level text,
  competence text[] NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'a_completer' CHECK (status IN (
    'brouillon',
    'a_completer',
    'relu',
    'valide',
    'remplace'
  )),
  content_html text,
  content_json jsonb,
  source_file_path text,
  file_url text,
  version integer NOT NULL DEFAULT 1,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_code, document_type, version)
);

CREATE INDEX IF NOT EXISTS idx_session_documents_session_code
  ON public.session_documents (session_code);

CREATE INDEX IF NOT EXISTS idx_session_documents_status
  ON public.session_documents (status);

-- Réutilise la fonction générique déjà créée par la migration
-- curriculum v2 foundations (20260705220000_curriculum_v2_foundations.sql).
DROP TRIGGER IF EXISTS trg_session_documents_updated_at ON public.session_documents;
CREATE TRIGGER trg_session_documents_updated_at
  BEFORE UPDATE ON public.session_documents
  FOR EACH ROW EXECUTE FUNCTION public.touch_curriculum_updated_at();

-- ------------------------------------------------------------
-- RLS : accès formateur/admin uniquement (lecture + écriture).
-- Aucune policy élève : les brouillons ne sont jamais exposés
-- aux apprenants via cette table.
-- ------------------------------------------------------------
ALTER TABLE public.session_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_session_documents" ON public.session_documents;
CREATE POLICY "staff_read_session_documents"
  ON public.session_documents FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_insert_session_documents" ON public.session_documents;
CREATE POLICY "staff_insert_session_documents"
  ON public.session_documents FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_update_session_documents" ON public.session_documents;
CREATE POLICY "staff_update_session_documents"
  ON public.session_documents FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_session_documents" ON public.session_documents;
CREATE POLICY "curriculum_service_all_session_documents"
  ON public.session_documents FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

COMMIT;
