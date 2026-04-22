-- Table : ressources externes attachées à une séance
CREATE TABLE public.external_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  competence_id uuid REFERENCES public.points_a_maitriser(id),
  title text NOT NULL,
  url text NOT NULL,
  embed_type text NOT NULL CHECK (embed_type IN ('iframe','link_only')),
  provider text NOT NULL DEFAULT 'generic'
    CHECK (provider IN ('wordwall','learningapps','h5p','generic')),
  ordre int DEFAULT 0,
  embeddable_checked_at timestamptz,
  embeddable_result boolean,
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_external_resources_session ON public.external_resources(session_id);
CREATE INDEX idx_external_resources_created_by ON public.external_resources(created_by);

-- Table : résultats des élèves sur les ressources externes
CREATE TABLE public.external_resource_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_resource_id uuid NOT NULL REFERENCES public.external_resources(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id),
  score numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  time_spent_seconds int,
  difficulty_felt text CHECK (difficulty_felt IN ('easy','medium','hard')),
  comment text,
  screenshot_path text,
  source text NOT NULL DEFAULT 'declared'
    CHECK (source IN ('declared','auto_captured','imported_csv','validated')),
  validated_by uuid REFERENCES public.profiles(id),
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(external_resource_id, student_id)
);

CREATE INDEX idx_external_resource_results_resource ON public.external_resource_results(external_resource_id);
CREATE INDEX idx_external_resource_results_student ON public.external_resource_results(student_id);

-- Bucket de stockage pour les captures d'écran (privé)
INSERT INTO storage.buckets (id, name, public)
VALUES ('external-resource-screenshots', 'external-resource-screenshots', false)
ON CONFLICT (id) DO NOTHING;

-- RLS external_resources
ALTER TABLE public.external_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "formateur_crud_external_resources" ON public.external_resources
  FOR ALL
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "eleve_select_external_resources" ON public.external_resources
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions s
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE s.id = external_resources.session_id
        AND gm.eleve_id = auth.uid()
    )
  );

-- RLS external_resource_results
ALTER TABLE public.external_resource_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eleve_manage_own_results" ON public.external_resource_results
  FOR ALL
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "formateur_read_validate_results" ON public.external_resource_results
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.external_resources er
      JOIN public.sessions s ON s.id = er.session_id
      JOIN public.groups g ON g.id = s.group_id
      WHERE er.id = external_resource_results.external_resource_id
        AND g.formateur_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.external_resources er
      JOIN public.sessions s ON s.id = er.session_id
      JOIN public.groups g ON g.id = s.group_id
      WHERE er.id = external_resource_results.external_resource_id
        AND g.formateur_id = auth.uid()
    )
  );

-- Storage policies pour les captures d'écran
CREATE POLICY "owner_upload_screenshot" ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'external-resource-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "owner_read_screenshot" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'external-resource-screenshots'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "formateur_read_screenshot" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'external-resource-screenshots'
    AND EXISTS (
      SELECT 1 FROM public.external_resource_results err
      JOIN public.external_resources er ON er.id = err.external_resource_id
      JOIN public.sessions s ON s.id = er.session_id
      JOIN public.groups g ON g.id = s.group_id
      WHERE err.screenshot_path = storage.objects.name
        AND g.formateur_id = auth.uid()
    )
  );