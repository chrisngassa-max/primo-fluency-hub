CREATE TABLE IF NOT EXISTS resource_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id uuid REFERENCES ressources_pedagogiques(id) ON DELETE CASCADE,
  learner_id uuid REFERENCES profiles(id),
  group_id uuid REFERENCES groups(id),
  assigned_by uuid REFERENCES profiles(id),
  due_date timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE resource_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formateur_resource_assignments" ON resource_assignments
  USING (assigned_by = auth.uid())
  WITH CHECK (assigned_by = auth.uid());

CREATE POLICY "learner_view_resource_assignments" ON resource_assignments
  FOR SELECT USING (learner_id = auth.uid());