-- CAPTCF Lot 0.6 — reproducible refusal checks (run against linked DB)
-- Expectation: all assertions return true / zero dangerous privileges.

BEGIN;

DO $$
DECLARE
  trunc_n int;
  del_n int;
  sel_sensitive int;
BEGIN
  SELECT count(*) INTO trunc_n
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND has_table_privilege('anon', c.oid, 'TRUNCATE');

  SELECT count(*) INTO del_n
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND has_table_privilege('anon', c.oid, 'DELETE');

  SELECT count(*) INTO sel_sensitive
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r'
    AND c.relname IN (
      'profiles', 'user_roles', 'group_members', 'resultats', 'devoirs',
      'pedagogical_source_transcriptions', 'readiness_snapshots'
    )
    AND (
      has_table_privilege('anon', c.oid, 'SELECT')
      OR has_table_privilege('anon', c.oid, 'INSERT')
      OR has_table_privilege('anon', c.oid, 'UPDATE')
      OR has_table_privilege('anon', c.oid, 'DELETE')
      OR has_table_privilege('anon', c.oid, 'TRUNCATE')
    );

  IF trunc_n <> 0 THEN
    RAISE EXCEPTION 'Lot 0.6 FAIL: anon TRUNCATE on % tables', trunc_n;
  END IF;
  IF del_n <> 0 THEN
    RAISE EXCEPTION 'Lot 0.6 FAIL: anon DELETE on % tables', del_n;
  END IF;
  IF sel_sensitive <> 0 THEN
    RAISE EXCEPTION 'Lot 0.6 FAIL: anon privileges on sensitive tables (% hits)', sel_sensitive;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'pedagogical_images_insert_all',
        'pedagogical_images_update_all',
        'anon_play_token',
        'Anyone can insert a dossier',
        'Anyone can submit a lead',
        'enrollments: anon insert',
        'Anyone can insert checklist states',
        'lead_events: anon/auth insert',
        'cohorts: public open visible'
      )
  ) THEN
    RAISE EXCEPTION 'Lot 0.6 FAIL: dangerous anon/public policies still present';
  END IF;

  RAISE NOTICE 'Lot 0.6 refusal checks OK';
END $$;

ROLLBACK;
