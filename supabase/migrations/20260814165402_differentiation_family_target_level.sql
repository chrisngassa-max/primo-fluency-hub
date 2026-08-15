-- ============================================================
-- CapTCF — Multi-level CO slice families (A1/A2/B1/B2)
-- Ajoute target_level pour permettre plusieurs familles
-- indépendantes sur la même source audio, avec idempotence
-- par niveau. Ne modifie pas published_exercise_id.
-- Ne supprime / fusionne / archive aucune donnée existante.
-- ============================================================

BEGIN;

-- 1) Ajout nullable
ALTER TABLE public.differentiation_families
  ADD COLUMN IF NOT EXISTS target_level text;

-- 2) Backfill depuis payload.generated_levels[0] quand valide
UPDATE public.differentiation_families
SET target_level = payload #>> '{generated_levels,0}'
WHERE target_level IS NULL
  AND payload #>> '{generated_levels,0}' IN ('A1', 'A2', 'B1', 'B2');

-- 2bis) Backfill depuis generation.target_level si présent et valide
UPDATE public.differentiation_families
SET target_level = payload #>> '{generation,target_level}'
WHERE target_level IS NULL
  AND payload #>> '{generation,target_level}' IN ('A1', 'A2', 'B1', 'B2');

-- 3) Fallback A2 uniquement pour les anciennes familles réellement A2
UPDATE public.differentiation_families
SET target_level = 'A2'
WHERE target_level IS NULL
  AND (
    (payload->'variants' ? 'A2')
    OR COALESCE(payload #>> '{source_level}', 'A2') = 'A2'
  );

-- 4) Vérifier qu'aucune ligne incohérente ne reste
DO $$
DECLARE
  incoherent_count integer;
  duplicate_count integer;
BEGIN
  SELECT COUNT(*) INTO incoherent_count
  FROM public.differentiation_families
  WHERE target_level IS NULL
     OR target_level NOT IN ('A1', 'A2', 'B1', 'B2');

  IF incoherent_count > 0 THEN
    RAISE EXCEPTION
      'differentiation_families.target_level backfill incomplete: % incoherent row(s)',
      incoherent_count;
  END IF;

  -- Doublons qui bloqueraient l'index d'idempotence : ne pas auto-corriger.
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT 1
    FROM public.differentiation_families
    WHERE generation_status IN ('generating', 'generated')
      AND review_status <> 'archived'
    GROUP BY
      source_id,
      source_content_hash,
      competence,
      target_level,
      schema_version,
      referential_version
    HAVING COUNT(*) > 1
  ) AS dup;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION
      'differentiation_families idempotence duplicates detected: % group(s). Resolve manually before unique index.',
      duplicate_count;
  END IF;
END $$;

-- 5) CHECK constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'differentiation_families_target_level_check'
      AND conrelid = 'public.differentiation_families'::regclass
  ) THEN
    ALTER TABLE public.differentiation_families
      ADD CONSTRAINT differentiation_families_target_level_check
      CHECK (target_level IN ('A1', 'A2', 'B1', 'B2'));
  END IF;
END $$;

-- 6) NOT NULL + default
ALTER TABLE public.differentiation_families
  ALTER COLUMN target_level SET DEFAULT 'A2';

ALTER TABLE public.differentiation_families
  ALTER COLUMN target_level SET NOT NULL;

-- 7) Indexes
CREATE INDEX IF NOT EXISTS idx_differentiation_families_source_level
  ON public.differentiation_families
  (source_id, target_level, created_at DESC);

-- 8) Unique idempotence (exclut archived ; force_regenerate archive seulement non publié)
CREATE UNIQUE INDEX IF NOT EXISTS idx_differentiation_families_idempotence
  ON public.differentiation_families (
    source_id,
    source_content_hash,
    competence,
    target_level,
    schema_version,
    referential_version
  )
  WHERE generation_status IN ('generating', 'generated')
    AND review_status <> 'archived';

COMMIT;
