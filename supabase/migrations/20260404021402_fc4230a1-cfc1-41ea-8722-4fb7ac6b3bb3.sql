
CREATE TABLE public.activites_sauvegardees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  seance_numero INTEGER,
  titre TEXT NOT NULL,
  type_activite TEXT NOT NULL,
  niveau TEXT,
  duree_minutes INTEGER,
  contenu_genere JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.activites_sauvegardees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs manage own activites_sauvegardees"
  ON public.activites_sauvegardees
  FOR ALL
  TO authenticated
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());
