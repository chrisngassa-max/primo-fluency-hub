-- CAPTCF Lot 0.7 — future guards (transactional; intended to ROLLBACK)
-- Distinguishes: current anon confinement / residual policies / latent DEFAULT PRIVILEGES
-- Run via SQL editor or MCP execute_sql in a transaction you roll back.
-- Do not print secrets.

BEGIN;

DO $$
DECLARE
  anon_any int;
  anon_dangerous int;
  anon_sensitive int;
  permissive_n int;
  sandbox_n int;
  def_admin_anon_tables boolean := false;
  r record;
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

  -- Lot 0.8: residual named "Sandbox isolation" policies must be absent after apply.
  -- Lot 0.7 originally flagged them under a PERMISSIVE OR misreading; they were
  -- RESTRICTIVE. Forward fix = DROP (business policies sufficient). Guard keeps
  -- failing closed until remote Lot 0.8 is applied.
  SELECT count(*) INTO sandbox_n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname = 'Sandbox isolation'
    AND tablename IN (
      'groups', 'group_members', 'sessions', 'devoirs', 'resultats', 'profils_eleves'
    );

  IF sandbox_n <> 0 THEN
    RAISE EXCEPTION
      'Lot 0.7/0.8 FAIL: % residual Sandbox isolation policies — apply Lot 0.8 after owner authorization (or keep ARRÊT)',
      sandbox_n;
  END IF;

  -- True danger: PERMISSIVE policies that OR-open non-sandbox rows
  SELECT count(*) INTO sandbox_n
  FROM pg_policies
  WHERE schemaname = 'public'
    AND permissive = 'PERMISSIVE'
    AND coalesce(qual, '') ILIKE '%sandbox_session_id IS NULL%'
    AND coalesce(qual, '') ILIKE '%can_access_sandbox%';

  IF sandbox_n <> 0 THEN
    RAISE EXCEPTION
      'Lot 0.7/0.8 FAIL: % PERMISSIVE policy(ies) open sandbox_session_id IS NULL via can_access_sandbox',
      sandbox_n;
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

  RAISE NOTICE 'Lot 0.7 anon confinement assertions passed (before sandbox check outcome)';
END $$;

ROLLBACK;
