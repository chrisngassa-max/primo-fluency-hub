
CREATE TABLE public.bilan_post_devoirs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id UUID NOT NULL REFERENCES public.profiles(id),
  session_id UUID REFERENCES public.sessions(id),
  formateur_id UUID NOT NULL REFERENCES public.profiles(id),
  analyse_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_integrated BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bilan_post_devoirs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs manage own bilan_post_devoirs" ON public.bilan_post_devoirs
  FOR ALL TO public
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());

CREATE POLICY "Eleves view own bilan_post_devoirs" ON public.bilan_post_devoirs
  FOR SELECT TO public
  USING (eleve_id = auth.uid());
