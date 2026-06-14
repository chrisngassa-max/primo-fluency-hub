-- B6: Restore placement-test columns on test_sessions (schema drift fix).
-- The bilan/prospect lead-based schema (lead_id, scores JSONB) coexists with
-- the CAP TCF placement test schema (apprenant_id, paliers, scores par compétence).

-- ── Placement-test columns (additive, idempotent) ───────────────────────────
ALTER TABLE public.test_sessions
  ADD COLUMN IF NOT EXISTS apprenant_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS date_debut timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS date_fin timestamptz,
  ADD COLUMN IF NOT EXISTS statut text DEFAULT 'en_cours',
  ADD COLUMN IF NOT EXISTS palier_co integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS palier_ce integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS palier_eo integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS palier_ee integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS score_co integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_ce integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_eo integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_ee integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS profil_final text,
  ADD COLUMN IF NOT EXISTS groupe_suggere text,
  ADD COLUMN IF NOT EXISTS groupe_valide_par_formateur text;

-- Backfill date_debut from created_at when the lead schema replaced date_debut.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'test_sessions'
      AND column_name = 'created_at'
  ) THEN
    EXECUTE $sql$
      UPDATE public.test_sessions
      SET date_debut = COALESCE(date_debut, created_at)
      WHERE date_debut IS NULL AND created_at IS NOT NULL
    $sql$;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_test_sessions_apprenant_id
  ON public.test_sessions (apprenant_id)
  WHERE apprenant_id IS NOT NULL;

-- ── RLS: ensure placement-test policies exist ───────────────────────────────
DROP POLICY IF EXISTS "Eleves insert own test_sessions" ON public.test_sessions;
CREATE POLICY "Eleves insert own test_sessions"
  ON public.test_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (apprenant_id = auth.uid());

DROP POLICY IF EXISTS "Eleves view own test_sessions" ON public.test_sessions;
CREATE POLICY "Eleves view own test_sessions"
  ON public.test_sessions
  FOR SELECT
  TO authenticated
  USING (apprenant_id = auth.uid());

DROP POLICY IF EXISTS "Formateurs view student test_sessions" ON public.test_sessions;
CREATE POLICY "Formateurs view student test_sessions"
  ON public.test_sessions
  FOR SELECT
  TO authenticated
  USING (
    apprenant_id IN (
      SELECT gm.eleve_id FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Formateurs update test_sessions" ON public.test_sessions;
CREATE POLICY "Formateurs update test_sessions"
  ON public.test_sessions
  FOR UPDATE
  TO authenticated
  USING (
    apprenant_id IN (
      SELECT gm.eleve_id FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  )
  WITH CHECK (
    apprenant_id IN (
      SELECT gm.eleve_id FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE g.formateur_id = auth.uid()
    )
  );

-- Re-attach guard trigger if the function exists (Vague 1 hardening).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'guard_test_sessions_eleve_update'
  ) THEN
    DROP TRIGGER IF EXISTS guard_test_sessions_update ON public.test_sessions;
    CREATE TRIGGER guard_test_sessions_update
      BEFORE UPDATE ON public.test_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_test_sessions_eleve_update();
  END IF;
END $$;

COMMENT ON COLUMN public.test_sessions.apprenant_id IS
  'CAP TCF placement test: student profile. Nullable for legacy lead/prospect sessions.';
