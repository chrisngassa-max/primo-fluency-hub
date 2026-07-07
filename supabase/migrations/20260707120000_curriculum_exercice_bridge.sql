-- Pont curriculum v2 → banque exercices (Lot 6 bridge)
BEGIN;

ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS source text;

COMMENT ON COLUMN public.exercices.source IS
  'Origine de l''exercice (ex. curriculum_v2, banque manuelle).';

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercices_curriculum_metadata_code
  ON public.exercices (metadata_code)
  WHERE metadata_code LIKE 'cv2:%';

CREATE INDEX IF NOT EXISTS idx_exercices_source_curriculum
  ON public.exercices (source)
  WHERE source = 'curriculum_v2';

COMMIT;
