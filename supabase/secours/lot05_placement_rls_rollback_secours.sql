-- SECOURS Lot 0.5 — NOT a silent restore of the original open surface.
-- Decision explicite propriétaire requise avant application.
-- This rollback restores AUTHENTICATED-scoped policies only (no anon TRUNCATE/DELETE,
-- no USING(true) for public/anon). It does NOT re-grant anon full privileges.

BEGIN;

-- Keep anon revoked (do not re-open)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'placement_tests',
    'placement_test_items',
    'placement_test_attempts',
    'placement_test_answers',
    'placement_test_results',
    'placement_test_exports'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', t);
  END LOOP;
END $$;

-- If formateur UI regresses under has_role scoping, temporarily widen authenticated
-- SELECT on placement_tests / attempts to auth.uid() IS NOT NULL (still no anon):
-- DROP POLICY IF EXISTS placement_tests_select_authenticated ON public.placement_tests;
-- CREATE POLICY placement_tests_select_authenticated
--   ON public.placement_tests FOR SELECT TO authenticated
--   USING (auth.uid() IS NOT NULL);

COMMIT;
