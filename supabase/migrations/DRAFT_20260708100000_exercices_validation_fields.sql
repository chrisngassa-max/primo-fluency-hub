-- =============================================================================
-- DRAFT — Ne pas exécuter via supabase db push
-- DO NOT APPLY — Lot 9 socle
-- Lot 9 : colonnes validation sur public.exercices
-- Revue requise après audit dry-run (scripts/audit-exercices-validation.mjs)
-- Default : ROLLBACK ; décommenter COMMIT après GO explicite
-- =============================================================================

BEGIN;

-- ─── 1. Colonnes ───────────────────────────────────────────────────────────
ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'draft'
    CHECK (validation_status IN (
      'draft', 'validated_auto', 'needs_review', 'rejected', 'approved_human'
    )),
  ADD COLUMN IF NOT EXISTS validation_score smallint
    CHECK (validation_score IS NULL OR validation_score BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS validation_issues jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS validation_source text
    CHECK (validation_source IS NULL OR validation_source IN (
      'pipeline_auto', 'import', 'backfill', 'human', 'regeneration'
    )),
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;

-- ─── 2. Index search-first (futur — non actif tant que Lot 9 n'a pas GO) ───
CREATE INDEX IF NOT EXISTS idx_exercices_validation_reuse
  ON public.exercices (competence, niveau_vise, validation_status)
  WHERE is_template = false AND eleve_id IS NULL
    AND validation_status IN ('validated_auto', 'approved_human');

-- ─── 3. Commentaires ───────────────────────────────────────────────────────
COMMENT ON COLUMN public.exercices.validation_status IS
  'Cycle QA distinct de statut éditorial (draft/validated/published)';
COMMENT ON COLUMN public.exercices.validation_score IS
  'Score search-first 0-100 (nullable jusqu''à Lot L10)';
COMMENT ON COLUMN public.exercices.validation_issues IS
  'Issues agrégées L1-L7 (jsonb array)';
COMMENT ON COLUMN public.exercices.validation_checked_at IS
  'Horodatage dernière validation pipeline';
COMMENT ON COLUMN public.exercices.validation_source IS
  'Origine de la validation (pipeline_auto, backfill, human, etc.)';
COMMENT ON COLUMN public.exercices.reviewed_by IS
  'Formateur ayant validé manuellement (approved_human)';
COMMENT ON COLUMN public.exercices.reviewed_at IS
  'Horodatage revue humaine';

-- ─── 4. Vérification dry-run (lecture seule dans la transaction) ───────────
SELECT
  count(*) AS bank_total,
  count(*) FILTER (WHERE validation_status = 'draft') AS still_draft
FROM public.exercices
WHERE is_template = false AND eleve_id IS NULL;
-- Attendu post-migration : bank_total = 621, still_draft = 621

ROLLBACK;
-- COMMIT;  -- décommenter uniquement après GO §7 lot9-validation-socle-plan.md

-- DOWN (si migration appliquée par erreur) :
-- DROP INDEX IF EXISTS idx_exercices_validation_reuse;
-- ALTER TABLE public.exercices
--   DROP COLUMN IF EXISTS reviewed_at,
--   DROP COLUMN IF EXISTS reviewed_by,
--   DROP COLUMN IF EXISTS validation_source,
--   DROP COLUMN IF EXISTS validation_checked_at,
--   DROP COLUMN IF EXISTS validation_issues,
--   DROP COLUMN IF EXISTS validation_score,
--   DROP COLUMN IF EXISTS validation_status;
