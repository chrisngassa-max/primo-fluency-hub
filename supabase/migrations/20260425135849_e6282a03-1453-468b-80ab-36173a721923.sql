
-- Bucket pour stocker les captures d'écran de signalements
INSERT INTO storage.buckets (id, name, public)
VALUES ('exercise-reports', 'exercise-reports', false)
ON CONFLICT (id) DO NOTHING;

-- Table des signalements
CREATE TABLE IF NOT EXISTS public.exercise_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL,
  formateur_id uuid,
  exercice_id uuid,
  devoir_id uuid,
  bilan_test_id uuid,
  context text NOT NULL DEFAULT 'exercice',
  item_index integer,
  comment text,
  screenshot_path text,
  page_url text,
  user_agent text,
  status text NOT NULL DEFAULT 'nouveau',
  resolved_at timestamp with time zone,
  resolved_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.exercise_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eleves create own reports"
ON public.exercise_reports FOR INSERT TO authenticated
WITH CHECK (eleve_id = auth.uid());

CREATE POLICY "Eleves view own reports"
ON public.exercise_reports FOR SELECT TO authenticated
USING (eleve_id = auth.uid());

CREATE POLICY "Formateurs view own reports"
ON public.exercise_reports FOR SELECT TO authenticated
USING (formateur_id = auth.uid());

CREATE POLICY "Formateurs update own reports"
ON public.exercise_reports FOR UPDATE TO authenticated
USING (formateur_id = auth.uid())
WITH CHECK (formateur_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_exercise_reports_formateur ON public.exercise_reports(formateur_id, status);
CREATE INDEX IF NOT EXISTS idx_exercise_reports_eleve ON public.exercise_reports(eleve_id);

-- Storage policies
CREATE POLICY "Eleves upload own report screenshots"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exercise-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Eleves read own report screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'exercise-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Formateurs read all report screenshots"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'exercise-reports'
  AND EXISTS (
    SELECT 1 FROM public.exercise_reports er
    WHERE er.screenshot_path = storage.objects.name
      AND er.formateur_id = auth.uid()
  )
);
