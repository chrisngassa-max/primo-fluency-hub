-- ============================================================
-- CapTCF — Lot 2 "Documents de séance" : ordre global + audience
-- + types de documents vierges. Additive sur session_documents
-- (Lot 1, migration 20260708210000). S01 uniquement pour l'instant.
-- ============================================================

BEGIN;

-- 1. Assouplir l'unicité : le Lot 2 permet d'insérer plusieurs blocs
-- vierges du même document_type dans une même séance (ex : deux
-- note_formateur). La contrainte (session_code, document_type, version)
-- héritée du Lot 1 supposait un seul document par type et n'a plus lieu
-- d'être.
ALTER TABLE public.session_documents
  DROP CONSTRAINT IF EXISTS session_documents_session_code_document_type_version_key;

-- 2. Étendre le CHECK document_type avec les types de blocs vierges
-- insérables depuis "Insérer avant/après".
ALTER TABLE public.session_documents
  DROP CONSTRAINT IF EXISTS session_documents_document_type_check;

ALTER TABLE public.session_documents
  ADD CONSTRAINT session_documents_document_type_check CHECK (document_type IN (
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
    'exercice_interactif',
    'note_formateur',
    'consigne_apprenant',
    'activite_ecrite',
    'activite_orale',
    'support_libre'
  ));

-- 3. Colonnes Lot 2 : ordre global unique par séance (pas un ordre par
-- onglet — un document audience='both' doit avoir une seule position,
-- valable dans les deux vues) + audience pour router vers l'onglet.
ALTER TABLE public.session_documents
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS audience text NOT NULL DEFAULT 'staging'
    CHECK (audience IN ('formateur', 'apprenant', 'both', 'staging'));

-- 4. Backfill des 9 documents S01 existants (Lot 1) : audience reprise
-- du mapping utilisé jusqu'ici en dur dans SessionDocumentsPage.tsx,
-- display_order aligné sur le déroulé pédagogique (pas alphabétique).
UPDATE public.session_documents SET audience = 'formateur', display_order = 1
  WHERE session_code = 'S01' AND document_type = 'fiche_formateur';
UPDATE public.session_documents SET audience = 'apprenant', display_order = 2
  WHERE session_code = 'S01' AND document_type = 'fiche_apprenant';
UPDATE public.session_documents SET audience = 'apprenant', display_order = 3
  WHERE session_code = 'S01' AND document_type = 'dialogue_transcription';
UPDATE public.session_documents SET audience = 'apprenant', display_order = 4
  WHERE session_code = 'S01' AND document_type = 'qcm_tcf';
UPDATE public.session_documents SET audience = 'apprenant', display_order = 5
  WHERE session_code = 'S01' AND document_type = 'qcm_civique';
UPDATE public.session_documents SET audience = 'apprenant', display_order = 6
  WHERE session_code = 'S01' AND document_type = 'lexique';
UPDATE public.session_documents SET audience = 'apprenant', display_order = 7
  WHERE session_code = 'S01' AND document_type = 'support_visuel';
UPDATE public.session_documents SET audience = 'apprenant', display_order = 8
  WHERE session_code = 'S01' AND document_type = 'document_transforme';
UPDATE public.session_documents SET audience = 'formateur', display_order = 9
  WHERE session_code = 'S01' AND document_type = 'corrige_formateur';

CREATE INDEX IF NOT EXISTS idx_session_documents_order
  ON public.session_documents (session_code, display_order);

-- 5. RLS : la policy DELETE manquait (Lot 1 n'avait que SELECT/INSERT/
-- UPDATE + service_role ALL). Nécessaire pour nettoyer un bloc vierge/
-- test. Toujours aucun accès élève.
DROP POLICY IF EXISTS "staff_delete_session_documents" ON public.session_documents;
CREATE POLICY "staff_delete_session_documents"
  ON public.session_documents FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

COMMIT;
