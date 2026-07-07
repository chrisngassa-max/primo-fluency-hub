-- =============================================================================
-- Normalize public.exercices.contenu: jsonb string wrapper → inner jsonb object
-- Audit: 2026-07-07 (CapTCF bank)
-- Scope: is_template = false AND eleve_id IS NULL (621 rows)
--   - 392 legacy: jsonb_typeof(contenu) = 'string' with parseable inner object
--   - 229 already jsonb objects
-- Validation mirrors hasUsableContent() in exercise-search.ts (read-only reference)
--
-- Intended for Supabase SQL Editor (manual apply). Default transaction ends with
-- ROLLBACK; uncomment COMMIT to persist. Idempotent: re-run updates 0 rows once
-- strings are normalized.
-- =============================================================================

-- ─── 1. DRY-RUN (read-only — run this block alone first) ─────────────────────

-- Count rows to update (audit expectation: 392)
SELECT count(*) AS rows_to_update
FROM public.exercices
WHERE is_template = false
  AND eleve_id IS NULL
  AND jsonb_typeof(contenu) = 'string'
  AND jsonb_typeof((contenu #>> '{}')::jsonb) = 'object';

-- Sample 5 rows: before state
SELECT
  id,
  format,
  jsonb_typeof(contenu) AS contenu_type,
  left(contenu #>> '{}', 120) AS contenu_inner_preview
FROM public.exercices
WHERE is_template = false
  AND eleve_id IS NULL
  AND jsonb_typeof(contenu) = 'string'
  AND jsonb_typeof((contenu #>> '{}')::jsonb) = 'object'
ORDER BY id
LIMIT 5;


-- ─── 2. APPLICATION (default: ROLLBACK — swap to COMMIT to apply) ───────────

BEGIN;

-- Backup affected rows (dated snapshot)
DROP TABLE IF EXISTS public._backup_exercices_contenu_string_20260707;

CREATE TABLE public._backup_exercices_contenu_string_20260707 AS
SELECT
  e.id,
  e.contenu AS contenu_before,
  now() AT TIME ZONE 'UTC' AS backed_up_at
FROM public.exercices e
WHERE e.is_template = false
  AND e.eleve_id IS NULL
  AND jsonb_typeof(e.contenu) = 'string'
  AND jsonb_typeof((e.contenu #>> '{}')::jsonb) = 'object';

-- Normalize only bank rows whose contenu is a jsonb string wrapping an object
UPDATE public.exercices e
SET
  contenu = (e.contenu #>> '{}')::jsonb,
  updated_at = now()
WHERE e.is_template = false
  AND e.eleve_id IS NULL
  AND jsonb_typeof(e.contenu) = 'string'
  AND jsonb_typeof((e.contenu #>> '{}')::jsonb) = 'object';

-- Post-migration assertions (mirrors hasUsableContent in exercise-search.ts)
DO $$
DECLARE
  v_bank_total int;
  v_string_remaining int;
  v_usable int;
BEGIN
  SELECT count(*) INTO v_bank_total
  FROM public.exercices
  WHERE is_template = false
    AND eleve_id IS NULL;

  SELECT count(*) INTO v_string_remaining
  FROM public.exercices
  WHERE is_template = false
    AND eleve_id IS NULL
    AND jsonb_typeof(contenu) = 'string';

  IF v_string_remaining <> 0 THEN
    RAISE EXCEPTION
      'Assertion failed: % string contenu rows remain in bank (expected 0)',
      v_string_remaining;
  END IF;

  -- hasUsableContent mirror:
  --   consigne non-empty
  --   production_ecrite | production_orale → always usable
  --   else contenu.items must be a non-empty array
  SELECT count(*) INTO v_usable
  FROM public.exercices e
  WHERE e.is_template = false
    AND e.eleve_id IS NULL
    AND e.consigne IS NOT NULL
    AND btrim(e.consigne) <> ''
    AND (
      e.format IN ('production_ecrite', 'production_orale')
      OR (
        jsonb_typeof(e.contenu) = 'object'
        AND jsonb_typeof(e.contenu -> 'items') = 'array'
        AND jsonb_array_length(e.contenu -> 'items') > 0
      )
    );

  IF v_usable <> v_bank_total THEN
    RAISE EXCEPTION
      'Assertion failed: % / % bank rows pass hasUsableContent (expected all)',
      v_usable, v_bank_total;
  END IF;

  IF v_bank_total <> 621 THEN
    RAISE WARNING 'Bank row count is % (audit expected 621)', v_bank_total;
  END IF;

  RAISE NOTICE
    'OK: % bank rows, 0 string contenu, all pass hasUsableContent',
    v_bank_total;
END $$;

ROLLBACK;
-- COMMIT;


-- ─── 3. ROLLBACK (manual restore from backup) ────────────────────────────────
/*
BEGIN;

UPDATE public.exercices e
SET
  contenu = b.contenu_before,
  updated_at = now()
FROM public._backup_exercices_contenu_string_20260707 b
WHERE e.id = b.id;

-- Verify restore
DO $$
DECLARE
  v_restored int;
  v_backup int;
BEGIN
  SELECT count(*) INTO v_backup
  FROM public._backup_exercices_contenu_string_20260707;

  SELECT count(*) INTO v_restored
  FROM public.exercices e
  JOIN public._backup_exercices_contenu_string_20260707 b ON b.id = e.id
  WHERE e.contenu = b.contenu_before;

  IF v_restored <> v_backup THEN
    RAISE EXCEPTION
      'Rollback verify failed: % / % rows restored',
      v_restored, v_backup;
  END IF;

  RAISE NOTICE 'Rollback OK: % rows restored from backup', v_restored;
END $$;

COMMIT;
*/


-- ─── 4. VALIDATION QUERIES (commented — run before/after apply) ──────────────
/*
-- BEFORE / AFTER: bank inventory by contenu jsonb type
SELECT
  jsonb_typeof(contenu) AS contenu_type,
  count(*) AS n
FROM public.exercices
WHERE is_template = false
  AND eleve_id IS NULL
GROUP BY 1
ORDER BY 1;

-- BEFORE / AFTER: hasUsableContent pass rate (mirror exercise-search.ts)
SELECT
  count(*) FILTER (
    WHERE NOT (
      consigne IS NOT NULL
      AND btrim(consigne) <> ''
      AND (
        format IN ('production_ecrite', 'production_orale')
        OR (
          jsonb_typeof(contenu) = 'object'
          AND jsonb_typeof(contenu -> 'items') = 'array'
          AND jsonb_array_length(contenu -> 'items') > 0
        )
      )
    )
  ) AS failing_has_usable_content,
  count(*) AS bank_total
FROM public.exercices
WHERE is_template = false
  AND eleve_id IS NULL;

-- AFTER: list any bank rows still failing hasUsableContent (should be empty)
SELECT
  id,
  format,
  jsonb_typeof(contenu) AS contenu_type,
  consigne IS NOT NULL AND btrim(consigne) <> '' AS has_consigne,
  CASE
    WHEN format IN ('production_ecrite', 'production_orale') THEN true
    WHEN jsonb_typeof(contenu) = 'object'
      AND jsonb_typeof(contenu -> 'items') = 'array'
      AND jsonb_array_length(contenu -> 'items') > 0
    THEN true
    ELSE false
  END AS passes_has_usable_content
FROM public.exercices
WHERE is_template = false
  AND eleve_id IS NULL
  AND NOT (
    consigne IS NOT NULL
    AND btrim(consigne) <> ''
    AND (
      format IN ('production_ecrite', 'production_orale')
      OR (
        jsonb_typeof(contenu) = 'object'
        AND jsonb_typeof(contenu -> 'items') = 'array'
        AND jsonb_array_length(contenu -> 'items') > 0
      )
    )
  );
*/
