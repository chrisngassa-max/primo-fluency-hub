-- CAPTCF Lot 0.7 / 0.8B — future guards (transactional; intended to ROLLBACK)
-- Distinguishes: current anon confinement / Sandbox RESTRICTIVE inventory / latent DEFAULT PRIVILEGES
-- Run via SQL editor or MCP execute_sql in a transaction you roll back.
-- Do not print secrets.
--
-- Lot 0.8B: the six "Sandbox isolation" AS RESTRICTIVE policies MUST remain.
-- A PERMISSIVE policy with (sandbox_session_id IS NULL OR can_access_sandbox(...)) is FAIL.
-- Unexpected missing / PERMISSIVE conversion / altered expression is FAIL.

BEGIN;

DO $$
DECLARE
  anon_any int;
  anon_dangerous int;
  anon_sensitive int;
  permissive_n int;
  sandbox_n int;
  permissive_sandbox_n int;
  bad_row text;
  def_admin_anon_tables boolean := false;
  r record;
  expected_tables text[] := ARRAY[
    'groups', 'group_members', 'sessions', 'devoirs', 'resultats', 'profils_eleves'
  ];
  t text;
BEGIN
  -- 1) Current grants: anon must have zero table privileges in public
  SELECT count(*) INTO anon_any
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (
      has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
      OR has_table_privilege('anon', c.oid, 'TRUNCATE')
      OR has_table_privilege('anon', c.oid, 'REFERENCES')
      OR has_table_privilege('anon', c.oid, 'TRIGGER')
    );

  IF anon_any <> 0 THEN
    RAISE EXCEPTION 'Lot 0.7 FAIL: anon has privileges on % public table(s)', anon_any;
  END IF;

  SELECT count(*) INTO anon_dangerous
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND (
      has_table_privilege('anon', c.oid, 'TRUNCATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
      OR has_table_privilege('anon', c.oid, 'REFERENCES')
      OR has_table_privilege('anon', c.oid, 'TRIGGER')
    );

  IF anon_dangerous <> 0 THEN
    RAISE EXCEPTION 'Lot 0.7 FAIL: anon TRUNCATE/DELETE/REFERENCES/TRIGGER on % table(s)', anon_dangerous;
  END IF;

  SELECT count(*) INTO anon_sensitive
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relname IN (
      'profiles', 'user_roles', 'group_members', 'resultats', 'devoirs',
      'placement_test_attempts', 'placement_test_results',
      'pedagogical_source_transcriptions', 'readiness_snapshots'
    )
    AND (
      has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
      OR has_table_privilege('anon', c.oid, 'TRUNCATE')
    );

  IF anon_sensitive <> 0 THEN
    RAISE EXCEPTION 'Lot 0.7 FAIL: anon access on sensitive tables (% hits)', anon_sensitive;
  END IF;

  -- Manifestly permissive: USING/CHECK (true) on {public} or {anon} without service_role gate
  SELECT count(*) INTO permissive_n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND (
      'public' = ANY (roles)
      OR 'anon' = ANY (roles)
    )
    AND (
      coalesce(qual, '') ~* '^\s*true\s*$'
      OR coalesce(with_check, '') ~* '^\s*true\s*$'
    )
    AND coalesce(qual, '') NOT ILIKE '%service_role%'
    AND coalesce(with_check, '') NOT ILIKE '%service_role%';

  IF permissive_n <> 0 THEN
    RAISE EXCEPTION 'Lot 0.7 FAIL: % manifestly permissive public/anon policy(ies)', permissive_n;
  END IF;

  -- Lot 0.8B: exactly 6 named Sandbox isolation policies, all RESTRICTIVE SELECT,
  -- expression = sandbox_session_id IS NULL OR can_access_sandbox(sandbox_session_id)
  SELECT count(*) INTO sandbox_n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname = 'Sandbox isolation'
    AND tablename = ANY (expected_tables);

  IF sandbox_n <> 6 THEN
    RAISE EXCEPTION
      'Lot 0.8B FAIL: expected 6 Sandbox isolation policies, found % (unexpected disappearance)',
      sandbox_n;
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
      RAISE EXCEPTION
        'Lot 0.8B FAIL: missing Sandbox isolation on %', t;
    END IF;

    IF split_part(bad_row, '|', 2) <> 'SELECT' THEN
      RAISE EXCEPTION
        'Lot 0.8B FAIL: % Sandbox isolation cmd=% (expected SELECT)',
        t, split_part(bad_row, '|', 2);
    END IF;

    IF split_part(bad_row, '|', 3) <> 'RESTRICTIVE' THEN
      RAISE EXCEPTION
        'Lot 0.8B FAIL: % Sandbox isolation is % (expected RESTRICTIVE; PERMISSIVE = exposure)',
        t, split_part(bad_row, '|', 3);
    END IF;

    IF NOT (
      regexp_replace(split_part(bad_row, '|', 4), '\s+', ' ', 'g')
      ~*
      '^\(?\s*sandbox_session_id\s+IS\s+NULL\s*\)?\s+OR\s+(public\.)?can_access_sandbox\s*\(\s*sandbox_session_id\s*\)\s*$'
    ) THEN
      RAISE EXCEPTION
        'Lot 0.8B FAIL: % Sandbox isolation expression altered/widened: %',
        t, split_part(bad_row, '|', 4);
    END IF;
  END LOOP;

  -- True danger: PERMISSIVE policies that OR-open non-sandbox rows
  SELECT count(*) INTO permissive_sandbox_n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND permissive = 'PERMISSIVE'
    AND coalesce(qual, '') ILIKE '%sandbox_session_id IS NULL%'
    AND coalesce(qual, '') ILIKE '%can_access_sandbox%';

  IF permissive_sandbox_n <> 0 THEN
    RAISE EXCEPTION
      'Lot 0.8B FAIL: % PERMISSIVE policy(ies) open sandbox_session_id IS NULL OR can_access_sandbox',
      permissive_sandbox_n;
  END IF;

  -- Latent DEFAULT PRIVILEGES: supabase_admin → anon on future public tables
  FOR r IN
    SELECT pg_catalog.array_to_string(defaclacl, ',') AS acl
    FROM pg_default_acl
    WHERE defaclrole = (SELECT oid FROM pg_roles WHERE rolname = 'supabase_admin')
      AND defaclnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND defaclobjtype = 'r'
  LOOP
    IF r.acl ILIKE '%anon=%' THEN
      def_admin_anon_tables := true;
    END IF;
  END LOOP;

  IF def_admin_anon_tables THEN
    RAISE NOTICE
      'Lot 0.7 LATENT DEFAULT PRIVILEGES: supabase_admin still grants table privileges to anon on FUTURE public objects — operator cannot revoke (permission denied Lot 0.6); open Supabase support ticket. Mitigate with explicit REVOKE in every new-table migration.';
  ELSE
    RAISE NOTICE 'Lot 0.7: supabase_admin public table DEFAULT PRIVILEGES no longer include anon';
  END IF;

  RAISE NOTICE 'Lot 0.7/0.8B assertions passed (anon confinement + RESTRICTIVE Sandbox inventory)';
END $$;

ROLLBACK;
