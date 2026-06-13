-- Keep one unresolved alert for each learner and alert type.
WITH duplicates AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY formateur_id, eleve_id, type
      ORDER BY created_at DESC, id DESC
    ) AS duplicate_rank
  FROM public.alertes
  WHERE is_resolved = false
)
UPDATE public.alertes AS alert
SET
  is_resolved = true,
  resolved_at = COALESCE(alert.resolved_at, now())
FROM duplicates
WHERE alert.id = duplicates.id
  AND duplicates.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_alertes_one_active_per_learner_type
  ON public.alertes (formateur_id, eleve_id, type)
  WHERE is_resolved = false;
