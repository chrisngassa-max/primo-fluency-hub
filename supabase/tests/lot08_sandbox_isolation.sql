-- CAPTCF Lot 0.8 — Sandbox isolation tests (transactional ROLLBACK)
--
-- Lot 0.8B: Phase B DROP is ABANDONED. This file no longer authorizes or
-- rehearses a durable DROP of the six RESTRICTIVE policies.
--
-- Current purpose: document that a DROP simulation was historically explored
-- in Phase A, then assert the six RESTRICTIVE policies remain present with
-- the expected expression (same checks as lot07_future_guards.sql).
-- Prefer supabase/tests/lot07_future_guards.sql for operational assertions.

BEGIN;

DO $$
DECLARE
  residual int;
  t text;
  bad_row text;
  expected_tables text[] := ARRAY[
    'groups', 'group_members', 'sessions', 'devoirs', 'resultats', 'profils_eleves'
  ];
BEGIN
  SELECT count(*) INTO residual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname = 'Sandbox isolation'
    AND tablename = ANY (expected_tables);

  RAISE NOTICE 'Lot 0.8B Sandbox isolation policies present=% (expect 6 RESTRICTIVE)', residual;

  IF residual <> 6 THEN
    RAISE EXCEPTION
      'Lot 0.8B FAIL: expected 6 Sandbox isolation policies, found %', residual;
  END IF;

  FOREACH t IN ARRAY expected_tables
  LOOP
    SELECT format('%s|%s|%s|%s', tablename, cmd, permissive, coalesce(qual, ''))
      INTO bad_row
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = t
      AND policyname = 'Sandbox isolation';

    IF bad_row IS NULL THEN
      RAISE EXCEPTION 'Lot 0.8B FAIL: missing Sandbox isolation on %', t;
    END IF;

    IF split_part(bad_row, '|', 2) <> 'SELECT' THEN
      RAISE EXCEPTION 'Lot 0.8B FAIL: % cmd=%', t, split_part(bad_row, '|', 2);
    END IF;

    IF split_part(bad_row, '|', 3) <> 'RESTRICTIVE' THEN
      RAISE EXCEPTION
        'Lot 0.8B FAIL: % is % (PERMISSIVE = exposure; RESTRICTIVE required)',
        t, split_part(bad_row, '|', 3);
    END IF;

    IF NOT (
      regexp_replace(split_part(bad_row, '|', 4), '\s+', ' ', 'g')
      ~*
      '^\(?\s*sandbox_session_id\s+IS\s+NULL\s*\)?\s+OR\s+(public\.)?can_access_sandbox\s*\(\s*sandbox_session_id\s*\)\s*$'
    ) THEN
      RAISE EXCEPTION
        'Lot 0.8B FAIL: % expression altered: %',
        t, split_part(bad_row, '|', 4);
    END IF;
  END LOOP;

  -- Explicitly DO NOT DROP — Phase B abandoned (Lot 0.8B).
  RAISE NOTICE 'Lot 0.8B PASS: RESTRICTIVE Sandbox isolation inventory intact (no DROP)';
END $$;

ROLLBACK;
