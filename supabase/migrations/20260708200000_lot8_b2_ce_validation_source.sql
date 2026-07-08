-- =============================================================================
-- Lot 8 B2 CE — étendre validation_source pour lot8_p0_apply
-- Rapport : docs/lot8-b2-ce-post-apply-report.md
-- Périmètre : contrainte CHECK uniquement (aucune insertion SQL ici)
-- =============================================================================

ALTER TABLE public.exercices
  DROP CONSTRAINT IF EXISTS exercices_validation_source_check;

ALTER TABLE public.exercices
  ADD CONSTRAINT exercices_validation_source_check
  CHECK (validation_source IS NULL OR validation_source IN (
    'pipeline_auto', 'import', 'backfill', 'human', 'regeneration', 'human_recovery', 'lot8_p0_apply'
  ));
