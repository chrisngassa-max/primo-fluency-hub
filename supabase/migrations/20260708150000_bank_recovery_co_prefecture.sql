-- =============================================================================
-- Mini-lot récupération banque CO préfecture (métadonnées + validation)
-- Rapport : docs/bank-recovery-mini-lot-report.md
-- Default : ROLLBACK ; décommenter COMMIT après GO explicite
--   (docs/bank-recovery-co-prefecture-apply-report.md)
-- NE PAS APPLIQUER via supabase db push tant que GO non validé
--
-- Périmètre :
--   1 backfill theme/contexte_irn (634e81c6)
--   21 promotions needs_review → approved_human (human_recovery)
--   4 NR ambigus EXCLUS (L7 ambiguous_correction)
--
-- INTERDIT : contenu, consigne, format, niveau_vise, competence,
--            pedagogical_activities, génération B2 CE / Structures / B1 EE
-- =============================================================================

BEGIN;

-- ─── 0. Étendre validation_source pour human_recovery ───────────────────────
ALTER TABLE public.exercices
  DROP CONSTRAINT IF EXISTS exercices_validation_source_check;

ALTER TABLE public.exercices
  ADD CONSTRAINT exercices_validation_source_check
  CHECK (validation_source IS NULL OR validation_source IN (
    'pipeline_auto', 'import', 'backfill', 'human', 'regeneration', 'human_recovery'
  ));

-- ─── 1. Backfill theme prefecture (1 VA CO B1) ───────────────────────────────
UPDATE public.exercices
SET
  theme = 'prefecture',
  contexte_irn = CASE
    WHEN contexte_irn IS NULL OR btrim(contexte_irn) = '' OR contexte_irn = 'prefecture'
      THEN 'prefecture'
    ELSE contexte_irn
  END
WHERE id = '634e81c6-fbd1-4c96-afb9-8d122e4f5610'
  AND competence = 'CO'
  AND niveau_vise = 'B1'
  AND validation_status = 'validated_auto'
  AND (theme IS NULL OR btrim(theme) = '');

-- ─── 2. Promotion approved_human (21 NR préfecture A2/B1) ──────────────────
-- validation_profile, validation_issues : préservés (non modifiés)
UPDATE public.exercices
SET
  validation_status = 'approved_human',
  validation_source = 'human_recovery',
  reviewed_at = now()
WHERE id = ANY (ARRAY[
  'fb7f5239-449d-4814-8600-6b17f3236017',
  '12ede1af-823b-4284-a22b-777572c9e900',
  '3136af07-6d8a-41ea-8c34-7be16c843df8',
  '5448c46f-27cb-4add-8c67-9b3e4953d05c',
  '06be5180-3260-43bd-9b97-b908a11f6a68',
  '1b4d279d-6552-4e01-8d9b-5c5d426ddc36',
  '1e3ff1eb-0028-4284-97c8-357669d73a9c',
  '33382dd4-67d1-4435-8d69-890ac3e0ced8',
  '3ea5f382-39ec-40eb-b2df-594f582e3eec',
  '556cba0c-d037-4684-8ada-a5c2e97f6e52',
  '8c4a82ee-81c2-46db-af6f-415ed6d08d08',
  '913a5b72-73ff-43f0-a7dd-a149d4e73050',
  '9469de1a-f470-4e11-9b46-d5102d302a73',
  '91cefa80-42ec-4166-a41e-df5915b1c451',
  'd88de779-5bd1-4981-9d7b-6f1cd37b9484',
  'ad0f1e82-f166-4322-a237-ec4921f1fd6a',
  'c255174e-a56e-4f52-99d2-b652a5a84e50',
  'c5e62f1c-c187-4d90-bcfd-4ac281a7d730',
  'd41f46b7-dbe3-4dce-b717-076debcfb022',
  'de62e8d3-2561-4b58-883f-93d3391b9809',
  'e64b08bc-c725-4eb5-b6a2-55c0d10f19f5'
]::uuid[])
  AND validation_status = 'needs_review'
  AND validation_profile = 'legacy_bank'
  AND competence = 'CO'
  AND niveau_vise IN ('A2', 'B1')
  AND theme = 'prefecture';

-- ─── 3. Dry-run vérifications (dans la transaction, avant COMMIT) ────────────
SELECT count(*) AS theme_backfill_ok
FROM public.exercices
WHERE id = '634e81c6-fbd1-4c96-afb9-8d122e4f5610'
  AND theme = 'prefecture';
-- Attendu : 1

SELECT count(*) AS approved_human_promoted
FROM public.exercices
WHERE id = ANY (ARRAY[
  'fb7f5239-449d-4814-8600-6b17f3236017',
  '12ede1af-823b-4284-a22b-777572c9e900',
  '3136af07-6d8a-41ea-8c34-7be16c843df8',
  '5448c46f-27cb-4add-8c67-9b3e4953d05c',
  '06be5180-3260-43bd-9b97-b908a11f6a68',
  '1b4d279d-6552-4e01-8d9b-5c5d426ddc36',
  '1e3ff1eb-0028-4284-97c8-357669d73a9c',
  '33382dd4-67d1-4435-8d69-890ac3e0ced8',
  '3ea5f382-39ec-40eb-b2df-594f582e3eec',
  '556cba0c-d037-4684-8ada-a5c2e97f6e52',
  '8c4a82ee-81c2-46db-af6f-415ed6d08d08',
  '913a5b72-73ff-43f0-a7dd-a149d4e73050',
  '9469de1a-f470-4e11-9b46-d5102d302a73',
  '91cefa80-42ec-4166-a41e-df5915b1c451',
  'd88de779-5bd1-4981-9d7b-6f1cd37b9484',
  'ad0f1e82-f166-4322-a237-ec4921f1fd6a',
  'c255174e-a56e-4f52-99d2-b652a5a84e50',
  'c5e62f1c-c187-4d90-bcfd-4ac281a7d730',
  'd41f46b7-dbe3-4dce-b717-076debcfb022',
  'de62e8d3-2561-4b58-883f-93d3391b9809',
  'e64b08bc-c725-4eb5-b6a2-55c0d10f19f5'
]::uuid[])
  AND validation_status = 'approved_human'
  AND validation_source = 'human_recovery'
  AND validation_profile = 'legacy_bank';
-- Attendu : 21

SELECT count(*) AS ambiguous_unchanged
FROM public.exercices
WHERE id = ANY (ARRAY[
  '16ea8cbd-36a7-4131-90d1-a07f131e8541',
  '73fa072e-8136-4552-ab8e-9f38de873464',
  '5e1834e3-b2d9-472e-977c-42774a8437d9',
  'c27c0b88-fd75-4b0e-bced-057a7055a480'
]::uuid[])
  AND validation_status = 'needs_review';
-- Attendu : 4

SELECT count(*) AS forbidden_touched
FROM public.exercices
WHERE id = ANY (ARRAY[
  '16ea8cbd-36a7-4131-90d1-a07f131e8541',
  '73fa072e-8136-4552-ab8e-9f38de873464',
  '5e1834e3-b2d9-472e-977c-42774a8437d9',
  'c27c0b88-fd75-4b0e-bced-057a7055a480'
]::uuid[])
  AND validation_status = 'approved_human';
-- Attendu : 0

ROLLBACK;
-- GO explicite : remplacer ROLLBACK par COMMIT après validation
--   docs/bank-recovery-co-prefecture-apply-report.md

-- DOWN (si migration appliquée par erreur) :
-- Revert promotions :
-- UPDATE public.exercices SET validation_status='needs_review', validation_source='backfill', reviewed_at=NULL
-- WHERE id = ANY(<21 ids>) AND validation_source = 'human_recovery';
-- Revert backfill :
-- UPDATE public.exercices SET theme=NULL, contexte_irn=NULL
-- WHERE id = '634e81c6-fbd1-4c96-afb9-8d122e4f5610' AND theme = 'prefecture';
