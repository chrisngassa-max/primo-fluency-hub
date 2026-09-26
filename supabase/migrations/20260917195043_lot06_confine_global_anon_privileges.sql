-- CAPTCF Lot 0.6 — confinement global des privileges anon
-- Remote applied version: 20260917195043 (MCP apply_migration timestamp)
-- Forward-only. Does not modify historical migrations or Lot 0.5.
-- Does NOT widen authenticated grants. Public play/placement via Edge+service_role.
-- No in-repo consumer for marketing anon INSERT → revoke direct grants.
-- DEFAULT PRIVILEGES: best-effort (supabase_admin may be denied).

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', r.table_name);
  END LOOP;
END $$;

DO $$
DECLARE
  seq regclass;
BEGIN
  FOR seq IN
    SELECT c.oid::regclass
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'S'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon', seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', seq);
  END LOOP;
END $$;

DO $$
BEGIN
  BEGIN
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON TABLES FROM anon, PUBLIC;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM anon, PUBLIC;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON FUNCTIONS FROM anon, PUBLIC;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Lot 0.6: skipped postgres DEFAULT PRIVILEGES (insufficient_privilege)';
  END;

  BEGIN
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      REVOKE ALL ON TABLES FROM anon, PUBLIC;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM anon, PUBLIC;
    ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public
      REVOKE ALL ON FUNCTIONS FROM anon, PUBLIC;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'Lot 0.6: skipped supabase_admin DEFAULT PRIVILEGES (insufficient_privilege)';
  END;
END $$;

DROP POLICY IF EXISTS pedagogical_images_insert_all ON public.pedagogical_images;
DROP POLICY IF EXISTS pedagogical_images_update_all ON public.pedagogical_images;
DROP POLICY IF EXISTS pedagogical_images_select_active ON public.pedagogical_images;

CREATE POLICY pedagogical_images_select_active
  ON public.pedagogical_images
  FOR SELECT
  TO authenticated
  USING ((is_active = true) AND (rejected = false));

CREATE POLICY pedagogical_images_insert_formateur
  ON public.pedagogical_images
  FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'formateur'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY pedagogical_images_update_formateur
  ON public.pedagogical_images
  FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'formateur'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'formateur'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS anon_play_token ON public.exercices;

DROP POLICY IF EXISTS gabarits_select_all ON public.gabarits_pedagogiques;
CREATE POLICY gabarits_select_authenticated
  ON public.gabarits_pedagogiques
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedagogical_activities_select_all ON public.pedagogical_activities;
CREATE POLICY pedagogical_activities_select_authenticated
  ON public.pedagogical_activities
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedagogical_documents_select_all ON public.pedagogical_documents;
CREATE POLICY pedagogical_documents_select_authenticated
  ON public.pedagogical_documents
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS pedagogical_extraction_errors_select_all ON public.pedagogical_extraction_errors;
CREATE POLICY pedagogical_extraction_errors_select_authenticated
  ON public.pedagogical_extraction_errors
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'formateur'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Anyone can insert checklist states" ON public.checklist_states;
DROP POLICY IF EXISTS "enrollments: anon insert" ON public.cohort_enrollments;
DROP POLICY IF EXISTS "cohorts: public open visible" ON public.cohorts;
DROP POLICY IF EXISTS "Anyone can insert a dossier" ON public.dossiers;
DROP POLICY IF EXISTS "lead_events: anon/auth insert" ON public.lead_events;
DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.leads;

CREATE POLICY "Authenticated can submit a lead"
  ON public.leads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    ((email IS NOT NULL) AND ((length((email)::text) >= 3) AND (length((email)::text) <= 255)))
    OR (whatsapp_phone IS NOT NULL)
  );

CREATE POLICY "Authenticated can insert lead_events"
  ON public.lead_events
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert dossiers"
  ON public.dossiers
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert checklist states"
  ON public.checklist_states
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can insert cohort enrollments"
  ON public.cohort_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated can view public open cohorts"
  ON public.cohorts
  FOR SELECT
  TO authenticated
  USING (
    ((visibility)::text = 'public'::text)
    AND ((status)::text = ANY ((ARRAY['open'::character varying, 'confirming'::character varying, 'confirmed'::character varying])::text[]))
  );

DO $$
DECLARE
  fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'enqueue_email(text, jsonb)',
    'delete_email(text, bigint)',
    'read_email_batch(text, integer, integer)',
    'move_to_dlq(text, text, bigint, jsonb)',
    'purge_ai_processing_logs_older_than_12_months()',
    'purge_test_audio_older_than_12_months()',
    'auto_recalibrage_montant()',
    'auto_recalibrage_niveau()',
    'set_student_level_baseline(uuid, jsonb, date, text)',
    'update_andragogical_profile(uuid, jsonb)',
    'update_priorites_pedagogiques(uuid, text)',
    'assign_live_session_exercises(uuid, uuid[], uuid[])',
    'claim_session_block(uuid, text)',
    'claim_session_block_test(uuid, text)',
    'release_corrections(uuid, uuid, uuid[], text)',
    'publish_session_variants_run(uuid, uuid)',
    'sync_curriculum_session_exercises(uuid, uuid[])',
    'get_exercise_response_distribution(uuid, uuid)',
    'enqueue_next_homework_series()',
    'cleanup_previous_session_items()',
    'detect_erreur_repetee()',
    'notify_formateur_recalibrage()',
    'recalculate_score_risque()',
    'search_pedagogical_activities(text, text, text, integer, text[], integer)',
    'search_pedagogical_documents(text, text, text, integer)',
    'search_pedagogical_images(text, text, text, text, integer)',
    'get_cohort_enrolled_count(uuid)',
    'mark_resultat_correction_viewed(uuid)'
  ]
  LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', fn);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC', fn);
    EXCEPTION
      WHEN undefined_function THEN
        NULL;
    END;
  END LOOP;
END $$;

DO $$
BEGIN
  IF to_regclass('public._backup_exercices_contenu_string_20260707') IS NOT NULL THEN
    REVOKE ALL ON TABLE public._backup_exercices_contenu_string_20260707 FROM anon, PUBLIC;
    ALTER TABLE public._backup_exercices_contenu_string_20260707 ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;
