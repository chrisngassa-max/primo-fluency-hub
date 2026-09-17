-- CAPTCF Lot 0.8 — Sandbox isolation confinement tests (transactional ROLLBACK)
-- Conventions: SET LOCAL ROLE + request.jwt.claims (same as session_automation_test.sql).
-- No PII selected (counts / existence only). Safe to run on linked DB; always ROLLBACK.
--
-- Modes:
--   * Pre-apply: simulates DROP of the 6 policies then asserts matrix, then ROLLBACK
--     (remote unchanged).
--   * Post-apply: if policies already absent, asserts residual=0 + matrix on live state.

BEGIN;

DO $$
DECLARE
  v_stranger uuid := 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  v_formateur_id uuid;
  v_eleve_id uuid;
  v_other_formateur uuid;
  v_sbx_id uuid;
  v_sbx_eleve uuid;
  n_groups int;
  n_gm int;
  n_sess int;
  n_dev int;
  n_res int;
  n_pe int;
  n_sbx_groups int;
  n_own int;
  residual int;
  permissive_open int;
BEGIN
  -- Inventory: forbid PERMISSIVE policies that OR-open non-sandbox rows
  SELECT count(*) INTO permissive_open
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename IN ('groups','group_members','sessions','devoirs','resultats','profils_eleves')
    AND permissive = 'PERMISSIVE'
    AND coalesce(qual, '') ILIKE '%sandbox_session_id IS NULL%'
    AND coalesce(qual, '') ILIKE '%can_access_sandbox%';

  IF permissive_open <> 0 THEN
    RAISE EXCEPTION
      'Lot 0.8 FAIL: % PERMISSIVE policy(ies) open sandbox_session_id IS NULL via can_access_sandbox',
      permissive_open;
  END IF;

  SELECT count(*) INTO residual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname = 'Sandbox isolation'
    AND tablename IN ('groups','group_members','sessions','devoirs','resultats','profils_eleves');

  RAISE NOTICE 'Lot 0.8 residual Sandbox isolation policies before sim=%', residual;

  -- Simulate forward migration inside this transaction
  DROP POLICY IF EXISTS "Sandbox isolation" ON public.groups;
  DROP POLICY IF EXISTS "Sandbox isolation" ON public.group_members;
  DROP POLICY IF EXISTS "Sandbox isolation" ON public.sessions;
  DROP POLICY IF EXISTS "Sandbox isolation" ON public.devoirs;
  DROP POLICY IF EXISTS "Sandbox isolation" ON public.resultats;
  DROP POLICY IF EXISTS "Sandbox isolation" ON public.profils_eleves;

  SELECT count(*) INTO residual
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname = 'Sandbox isolation'
    AND tablename IN ('groups','group_members','sessions','devoirs','resultats','profils_eleves');

  IF residual <> 0 THEN
    RAISE EXCEPTION 'Lot 0.8 FAIL: DROP left % Sandbox isolation policies', residual;
  END IF;

  SELECT ss.formateur_id, ss.id, (ss.eleve_user_ids)[1]
    INTO v_formateur_id, v_sbx_id, v_sbx_eleve
  FROM sandbox_sessions ss
  WHERE ss.statut = 'active'
  LIMIT 1;

  SELECT gm.eleve_id INTO v_eleve_id
  FROM group_members gm
  WHERE gm.sandbox_session_id IS NULL
  LIMIT 1;

  SELECT g.formateur_id INTO v_other_formateur
  FROM groups g
  WHERE g.sandbox_session_id IS NULL
    AND (v_formateur_id IS NULL OR g.formateur_id <> v_formateur_id)
  LIMIT 1;

  -- anon: no table privilege
  EXECUTE 'SET LOCAL ROLE anon';
  RESET request.jwt.claims;
  IF has_table_privilege('anon', 'public.groups', 'SELECT')
     OR has_table_privilege('anon', 'public.devoirs', 'SELECT')
     OR has_table_privilege('anon', 'public.resultats', 'SELECT') THEN
    RAISE EXCEPTION 'Lot 0.8 FAIL: anon still has SELECT on sandbox tables';
  END IF;
  RAISE NOTICE 'OK anon no SELECT grant';

  -- authenticated stranger: zero rows
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', v_stranger, 'role', 'authenticated')::text,
    true
  );
  SELECT count(*) INTO n_groups FROM groups;
  SELECT count(*) INTO n_gm FROM group_members;
  SELECT count(*) INTO n_sess FROM sessions;
  SELECT count(*) INTO n_dev FROM devoirs;
  SELECT count(*) INTO n_res FROM resultats;
  SELECT count(*) INTO n_pe FROM profils_eleves;
  IF n_groups <> 0 OR n_gm <> 0 OR n_sess <> 0 OR n_dev <> 0 OR n_res <> 0 OR n_pe <> 0 THEN
    RAISE EXCEPTION
      'Lot 0.8 FAIL stranger rows g=% gm=% s=% d=% r=% pe=%',
      n_groups, n_gm, n_sess, n_dev, n_res, n_pe;
  END IF;
  RAISE NOTICE 'OK stranger=0';

  -- prod eleve: own scope only; no foreign sandbox
  IF v_eleve_id IS NOT NULL THEN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_eleve_id, 'role', 'authenticated')::text,
      true
    );
    SELECT count(*) INTO n_gm FROM group_members WHERE eleve_id <> v_eleve_id;
    SELECT count(*) INTO n_dev FROM devoirs WHERE eleve_id <> v_eleve_id;
    SELECT count(*) INTO n_res FROM resultats WHERE eleve_id <> v_eleve_id;
    SELECT count(*) INTO n_pe FROM profils_eleves WHERE eleve_id <> v_eleve_id;
    SELECT count(*) INTO n_sbx_groups FROM groups WHERE sandbox_session_id IS NOT NULL;
    IF n_gm <> 0 OR n_dev <> 0 OR n_res <> 0 OR n_pe <> 0 THEN
      RAISE EXCEPTION 'Lot 0.8 FAIL eleve foreign gm=% d=% r=% pe=%', n_gm, n_dev, n_res, n_pe;
    END IF;
    IF n_sbx_groups <> 0 AND (v_sbx_eleve IS NULL OR v_eleve_id <> v_sbx_eleve) THEN
      RAISE EXCEPTION 'Lot 0.8 FAIL eleve foreign sandbox groups=%', n_sbx_groups;
    END IF;
    RAISE NOTICE 'OK prod eleve scoped';
  ELSE
    RAISE NOTICE 'SKIP prod eleve';
  END IF;

  -- formateur sandbox owner: own sandbox retained; no foreign groups
  IF v_formateur_id IS NOT NULL AND v_sbx_id IS NOT NULL THEN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_formateur_id, 'role', 'authenticated')::text,
      true
    );
    SELECT count(*) INTO n_own FROM groups WHERE sandbox_session_id = v_sbx_id;
    SELECT count(*) INTO n_groups FROM groups WHERE formateur_id <> v_formateur_id;
    IF n_groups <> 0 THEN
      RAISE EXCEPTION 'Lot 0.8 FAIL formateur foreign groups=%', n_groups;
    END IF;
    IF n_own < 1 THEN
      RAISE EXCEPTION 'Lot 0.8 FAIL formateur lost own sandbox groups';
    END IF;
    RAISE NOTICE 'OK formateur own_sandbox_groups=%', n_own;
  ELSE
    RAISE NOTICE 'SKIP sandbox formateur';
  END IF;

  -- other formateur: no foreign sandbox
  IF v_other_formateur IS NOT NULL AND v_sbx_id IS NOT NULL THEN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_other_formateur, 'role', 'authenticated')::text,
      true
    );
    SELECT count(*) INTO n_sbx_groups FROM groups WHERE sandbox_session_id = v_sbx_id;
    SELECT count(*) INTO n_gm FROM group_members WHERE sandbox_session_id = v_sbx_id;
    SELECT count(*) INTO n_dev FROM devoirs WHERE sandbox_session_id = v_sbx_id;
    SELECT count(*) INTO n_res FROM resultats WHERE sandbox_session_id = v_sbx_id;
    SELECT count(*) INTO n_pe FROM profils_eleves WHERE sandbox_session_id = v_sbx_id;
    SELECT count(*) INTO n_sess FROM sessions WHERE sandbox_session_id = v_sbx_id;
    IF n_sbx_groups <> 0 OR n_gm <> 0 OR n_dev <> 0 OR n_res <> 0 OR n_pe <> 0 OR n_sess <> 0 THEN
      RAISE EXCEPTION
        'Lot 0.8 FAIL other formateur sandbox leak g=% gm=% d=% r=% pe=% s=%',
        n_sbx_groups, n_gm, n_dev, n_res, n_pe, n_sess;
    END IF;
    RAISE NOTICE 'OK other formateur blocked';
  ELSE
    RAISE NOTICE 'SKIP other formateur';
  END IF;

  -- sandbox member: own membership only
  IF v_sbx_eleve IS NOT NULL AND v_sbx_id IS NOT NULL THEN
    EXECUTE 'SET LOCAL ROLE authenticated';
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', v_sbx_eleve, 'role', 'authenticated')::text,
      true
    );
    SELECT count(*) INTO n_own
    FROM group_members
    WHERE eleve_id = v_sbx_eleve AND sandbox_session_id = v_sbx_id;
    SELECT count(*) INTO n_gm
    FROM group_members
    WHERE sandbox_session_id = v_sbx_id AND eleve_id <> v_sbx_eleve;
    IF n_own < 1 THEN
      RAISE EXCEPTION 'Lot 0.8 FAIL sandbox eleve lost membership';
    END IF;
    IF n_gm <> 0 THEN
      RAISE EXCEPTION 'Lot 0.8 FAIL sandbox eleve sees other members=%', n_gm;
    END IF;
    RAISE NOTICE 'OK sandbox eleve memberships=%', n_own;
  ELSE
    RAISE NOTICE 'SKIP sandbox eleve';
  END IF;

  -- service_role operational read
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  SELECT count(*) INTO n_groups FROM groups;
  IF n_groups < 1 THEN
    RAISE EXCEPTION 'Lot 0.8 FAIL service_role cannot read groups';
  END IF;
  RAISE NOTICE 'OK service_role groups=%', n_groups;

  RAISE NOTICE 'Lot 0.8 sandbox isolation DROP simulation matrix PASSED';
END $$;

ROLLBACK;
