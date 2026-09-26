-- =============================================================================
-- CAPTCF Lot 2A — has_role + RLS role matrix tests (TRANSACTIONAL / ROLLBACK)
-- Run manually against a clone or with owner-approved read+tx sandbox.
-- Harness imports results via --sql-results (never auto-connects).
-- Distinguishes: pass | fail | not_run | env_error
-- =============================================================================

BEGIN;

-- Fixture roles / users are synthetic UUIDs — do not use production PII.
DO $$
DECLARE
  v_trainer uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1';
  v_learner uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2';
  v_stranger uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa3';
  v_admin uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa4';
  v_ok boolean;
BEGIN
  -- Signature probe: canonical named args (must exist on remote)
  BEGIN
    EXECUTE 'SELECT public.has_role($1, $2::public.app_role)' INTO v_ok USING v_trainer, 'formateur';
  EXCEPTION WHEN undefined_function THEN
    RAISE EXCEPTION 'env_error: has_role(uuid, app_role) missing';
  END;

  -- NULL uid → false
  IF public.has_role(NULL::uuid, 'formateur'::public.app_role) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'fail: has_role(NULL) should be false';
  END IF;

  RAISE NOTICE 'pass: has_role positional + null behavior smoke (no user_roles rows asserted here)';
END $$;

-- Document expected caller contract checks (application-level; SQL cannot call Edge).
-- See scripts/security/assert-lot2a-has-role-callers.mjs

-- Sandbox RESTRICTIVE non-regression (Lot 0.8B): count must be 6
DO $$
DECLARE
  v_count int;
BEGIN
  SELECT count(*) INTO v_count
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND p.polname = 'Sandbox isolation'
    AND p.polpermissive = false;
  IF v_count IS DISTINCT FROM 6 THEN
    RAISE EXCEPTION 'fail: expected 6 RESTRICTIVE Sandbox isolation, got %', v_count;
  END IF;
  RAISE NOTICE 'pass: sandbox restrictive count=6';
END $$;

-- {public} residual count probe (informational after B1–B4)
DO $$
DECLARE
  v_public int;
BEGIN
  SELECT count(*) INTO v_public
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND (p.polroles = '{}' OR p.polroles IS NULL);
  RAISE NOTICE 'info: public-role policy count=% (Lot0.7/2A baseline 113)', v_public;
END $$;

ROLLBACK;
