
-- 1. Add missing columns
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS statut text DEFAULT 'draft';
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS is_live_ready boolean DEFAULT false;
ALTER TABLE exercices ADD COLUMN IF NOT EXISTS play_token text UNIQUE DEFAULT gen_random_uuid()::text;

ALTER TABLE exercices DROP CONSTRAINT IF EXISTS exercices_statut_check;
ALTER TABLE exercices ADD CONSTRAINT exercices_statut_check
  CHECK (statut IN ('draft','to_review','validated','published','rejected','archived'));

-- 2. Create missing tables
CREATE TABLE IF NOT EXISTS exercise_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid REFERENCES exercices(id) ON DELETE CASCADE,
  learner_id uuid REFERENCES profiles(id),
  group_id uuid REFERENCES groups(id),
  assigned_by uuid REFERENCES profiles(id),
  context text CHECK (context IN ('autonomie','devoir','live','remediation')),
  due_date timestamptz,
  sync_status text DEFAULT 'local',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid REFERENCES exercices(id),
  assignment_id uuid REFERENCES exercise_assignments(id),
  learner_id uuid REFERENCES profiles(id),
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  time_spent_seconds int,
  status text DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','abandoned')),
  score_raw float,
  score_normalized float,
  answers jsonb,
  item_results jsonb,
  feedback_text text,
  source_app text DEFAULT 'connect',
  created_at timestamptz DEFAULT now()
);

-- 3. Drop ALL existing policies on exercices
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'exercices' LOOP
    EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON exercices';
  END LOOP;
END$$;

-- 4. Add clean unified policies on exercices
CREATE POLICY "anon_play_token" ON exercices
  FOR SELECT USING (play_token IS NOT NULL AND is_live_ready = true);

CREATE POLICY "formateur_own_exercises" ON exercices
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());

CREATE POLICY "auth_read_validated_exercises" ON exercices
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND statut IN ('validated', 'published')
  );

-- 5. Enable RLS and add policies on new tables
ALTER TABLE exercise_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formateur_assignments" ON exercise_assignments
  USING (assigned_by = auth.uid())
  WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "learner_own_assignments" ON exercise_assignments
  FOR SELECT USING (learner_id = auth.uid());

CREATE POLICY "learner_own_attempts" ON exercise_attempts
  USING (learner_id = auth.uid())
  WITH CHECK (learner_id = auth.uid());

CREATE POLICY "formateur_read_attempts" ON exercise_attempts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM exercices
      WHERE exercices.id = exercise_attempts.exercise_id
      AND exercices.formateur_id = auth.uid()
    )
  );
