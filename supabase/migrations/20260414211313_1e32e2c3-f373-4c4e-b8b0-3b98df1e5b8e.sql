CREATE POLICY "eleves_view_assigned_exercices" ON exercices
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM exercise_assignments
      WHERE exercise_assignments.exercise_id = exercices.id
      AND exercise_assignments.learner_id = auth.uid()
    )
  );