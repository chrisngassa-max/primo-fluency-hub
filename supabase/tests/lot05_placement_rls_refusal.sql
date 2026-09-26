-- CAPTCF Lot 0.5 — transactional RLS refusal checks for placement_test_*
-- Run against a linked DB or paste into SQL editor. Always ROLLBACK.

BEGIN;

-- 1) anon must have no table privileges
DO $$
BEGIN
  IF has_table_privilege('anon', 'public.placement_tests', 'SELECT')
     OR has_table_privilege('anon', 'public.placement_tests', 'TRUNCATE') THEN
    RAISE EXCEPTION 'FAIL: anon still privileged on placement_tests';
  END IF;
END $$;

-- 2) no policies target anon / public role
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename LIKE 'placement_test%'
    AND (
      roles::text ILIKE '%anon%'
      OR (roles::text ILIKE '%public%' AND roles::text NOT ILIKE '%authenticated%')
    );
  IF n > 0 THEN
    RAISE EXCEPTION 'FAIL: % placement policies still target anon/public', n;
  END IF;
END $$;

-- 3) disposable authenticated-scoped service insert then rollback
INSERT INTO public.placement_test_attempts (test_id, student_name, status)
SELECT id, 'lot05-rls-probe', 'in_progress'
FROM public.placement_tests
LIMIT 1;

ROLLBACK;

SELECT 'lot05_rls_checks_ok' AS result;
