-- ============================================================
-- CapTCF — Lot 3 "Documents de séance" : pont vers la bibliothèque
-- d'exercices, sans dupliquer les exercices. Additive sur
-- session_documents (Lot 1/2). S01 uniquement pour l'instant.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. session_document_links — ne référence jamais le contenu d'un
-- exercice, seulement son id (linked_id). display_order partage le
-- même espace de numérotation que session_documents.display_order
-- pour un même session_code : les deux tables forment un seul
-- déroulé fusionné, trié en mémoire côté client puis renuméroté
-- dans les deux tables après chaque opération (déplacer/insérer/
-- retirer). Pas de session_document_id : la position est portée
-- uniquement par display_order, pas par une référence permanente.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_document_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  linked_type text NOT NULL CHECK (linked_type IN (
    'exercise',
    'pdf',
    'docx',
    'html',
    'note',
    'generated_document'
  )),
  linked_id uuid NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  audience text NOT NULL CHECK (audience IN ('formateur', 'apprenant', 'both', 'staging')),
  display_order integer NOT NULL,
  title text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- Seul 'exercise' est implémenté au Lot 3 ; les autres valeurs du CHECK
  -- ci-dessus sont réservées pour de futurs lots (pdf/docx/html/note/
  -- generated_document), volontairement non actives ici.
  CONSTRAINT session_document_links_only_exercise_for_now CHECK (linked_type = 'exercise')
);

CREATE INDEX IF NOT EXISTS idx_session_document_links_session
  ON public.session_document_links (session_code, display_order);

CREATE INDEX IF NOT EXISTS idx_session_document_links_linked_id
  ON public.session_document_links (linked_id);

DROP TRIGGER IF EXISTS trg_session_document_links_updated_at ON public.session_document_links;
CREATE TRIGGER trg_session_document_links_updated_at
  BEFORE UPDATE ON public.session_document_links
  FOR EACH ROW EXECUTE FUNCTION public.touch_curriculum_updated_at();

-- ------------------------------------------------------------
-- RLS : formateur/admin uniquement, CRUD complet (contrairement à
-- session_documents, ici l'INSERT/UPDATE/DELETE sont symétriques :
-- ajouter/déplacer/retirer un lien sont tous des gestes formateur
-- courants, pas seulement la lecture). Aucune policy élève.
-- ------------------------------------------------------------
ALTER TABLE public.session_document_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_read_session_document_links" ON public.session_document_links;
CREATE POLICY "staff_read_session_document_links"
  ON public.session_document_links FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_insert_session_document_links" ON public.session_document_links;
CREATE POLICY "staff_insert_session_document_links"
  ON public.session_document_links FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_update_session_document_links" ON public.session_document_links;
CREATE POLICY "staff_update_session_document_links"
  ON public.session_document_links FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "staff_delete_session_document_links" ON public.session_document_links;
CREATE POLICY "staff_delete_session_document_links"
  ON public.session_document_links FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "curriculum_service_all_session_document_links" ON public.session_document_links;
CREATE POLICY "curriculum_service_all_session_document_links"
  ON public.session_document_links FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- ------------------------------------------------------------
-- 2. Gap RLS découvert en construisant la recherche Lot 3 : la
-- policy existante "auth_read_validated_exercices" (migration
-- 20260414211154) filtre sur exercices.statut IN ('validated',
-- 'published') — un champ de pipeline différent de
-- validation_status (Lot 9). En pratique, toute la banque actuelle
-- a statut='draft' (jamais migré) même quand validation_status est
-- 'validated_auto'/'approved_human'. Sans policy supplémentaire, un
-- formateur non-propriétaire de la ligne (formateur_id <> auth.uid())
-- ne peut lire AUCUN exercice de banque : la recherche Lot 3
-- renverrait toujours 0 résultat. On ajoute une policy dédiée,
-- strictement scopée à la banque partagée (jamais aux copies-élèves).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "staff_read_bank_exercices" ON public.exercices;
CREATE POLICY "staff_read_bank_exercices"
  ON public.exercices FOR SELECT TO authenticated
  USING (
    is_template = false
    AND eleve_id IS NULL
    AND (
      public.has_role(auth.uid(), 'formateur'::public.app_role)
      OR public.has_role(auth.uid(), 'admin'::public.app_role)
    )
  );

COMMIT;
