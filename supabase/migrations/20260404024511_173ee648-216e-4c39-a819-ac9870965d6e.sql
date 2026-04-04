
CREATE TABLE IF NOT EXISTS public.formateur_competences_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seance_id UUID NOT NULL,
  formateur_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competences_ordonnees JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seance_id, formateur_id)
);

ALTER TABLE public.formateur_competences_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs manage own competences_config"
  ON public.formateur_competences_config
  FOR ALL
  TO authenticated
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());
