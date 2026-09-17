-- CAPTCF Lot 0.5 — confinement RLS/GRANT placement_test_*
-- Forward-only. Does not modify historical migrations.
-- Legitimate public passation uses Edge Functions with service_role
-- (get-placement-test / generate-placement-test), not direct anon table access.
-- Formateur/élève UI uses authenticated client with scoped policies below.

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) Revoke dangerous / unnecessary privileges from anon
-- ---------------------------------------------------------------------------
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
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', t);
    -- Keep authenticated DML needed by UI; strip TRUNCATE/REFERENCES/TRIGGER/DELETE
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER, DELETE ON TABLE public.%I FROM authenticated',
      t
    );
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.%I TO authenticated',
      t
    );
    -- service_role retains full access (bypass RLS)
    EXECUTE format(
      'GRANT ALL ON TABLE public.%I TO service_role',
      t
    );
  END LOOP;
END $$;

-- Sequences used by placement tables (if any owned sequences exist)
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
      AND c.relname LIKE 'placement_test%'
  LOOP
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon', seq);
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', seq);
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE %s TO authenticated', seq);
    EXECUTE format('GRANT ALL ON SEQUENCE %s TO service_role', seq);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Drop all existing policies on placement_test_* (idempotent)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename LIKE 'placement_test%'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      r.policyname, r.schemaname, r.tablename
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 3) Minimum necessary policies (TO authenticated / service_role only)
-- ---------------------------------------------------------------------------

-- placement_tests
CREATE POLICY placement_tests_select_authenticated
  ON public.placement_tests
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR created_by = auth.uid()
    OR status = 'published'
  );

CREATE POLICY placement_tests_insert_formateur
  ON public.placement_tests
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    AND created_by = auth.uid()
  );

CREATE POLICY placement_tests_update_owner_or_formateur
  ON public.placement_tests
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR created_by = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR created_by = auth.uid()
  );

CREATE POLICY placement_tests_service_all
  ON public.placement_tests
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- placement_test_items
CREATE POLICY placement_test_items_select_authenticated
  ON public.placement_test_items
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_tests t
      WHERE t.id = placement_test_items.test_id
        AND (t.created_by = auth.uid() OR t.status = 'published')
    )
  );

CREATE POLICY placement_test_items_write_formateur
  ON public.placement_test_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_tests t
      WHERE t.id = placement_test_items.test_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY placement_test_items_update_formateur
  ON public.placement_test_items
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_tests t
      WHERE t.id = placement_test_items.test_id
        AND t.created_by = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_tests t
      WHERE t.id = placement_test_items.test_id
        AND t.created_by = auth.uid()
    )
  );

CREATE POLICY placement_test_items_service_all
  ON public.placement_test_items
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- placement_test_attempts
CREATE POLICY placement_test_attempts_select_scoped
  ON public.placement_test_attempts
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR student_id = auth.uid()
  );

CREATE POLICY placement_test_attempts_insert_own_or_formateur
  ON public.placement_test_attempts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR student_id = auth.uid()
    OR student_id IS NULL
  );

CREATE POLICY placement_test_attempts_update_scoped
  ON public.placement_test_attempts
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR student_id = auth.uid()
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR student_id = auth.uid()
  );

CREATE POLICY placement_test_attempts_service_all
  ON public.placement_test_attempts
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- placement_test_answers
CREATE POLICY placement_test_answers_select_scoped
  ON public.placement_test_answers
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_test_attempts a
      WHERE a.id = placement_test_answers.attempt_id
        AND a.student_id = auth.uid()
    )
  );

CREATE POLICY placement_test_answers_insert_scoped
  ON public.placement_test_answers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_test_attempts a
      WHERE a.id = placement_test_answers.attempt_id
        AND (a.student_id = auth.uid() OR a.student_id IS NULL)
    )
  );

CREATE POLICY placement_test_answers_update_scoped
  ON public.placement_test_answers
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_test_attempts a
      WHERE a.id = placement_test_answers.attempt_id
        AND a.student_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_test_attempts a
      WHERE a.id = placement_test_answers.attempt_id
        AND a.student_id = auth.uid()
    )
  );

CREATE POLICY placement_test_answers_service_all
  ON public.placement_test_answers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- placement_test_results
CREATE POLICY placement_test_results_select_scoped
  ON public.placement_test_results
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.placement_test_attempts a
      WHERE a.id = placement_test_results.attempt_id
        AND a.student_id = auth.uid()
    )
  );

CREATE POLICY placement_test_results_insert_formateur
  ON public.placement_test_results
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'formateur'::public.app_role));

CREATE POLICY placement_test_results_service_all
  ON public.placement_test_results
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- placement_test_exports
CREATE POLICY placement_test_exports_select_formateur
  ON public.placement_test_exports
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'formateur'::public.app_role));

CREATE POLICY placement_test_exports_insert_formateur
  ON public.placement_test_exports
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'formateur'::public.app_role));

CREATE POLICY placement_test_exports_update_formateur
  ON public.placement_test_exports
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'formateur'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'formateur'::public.app_role));

CREATE POLICY placement_test_exports_service_all
  ON public.placement_test_exports
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMIT;
