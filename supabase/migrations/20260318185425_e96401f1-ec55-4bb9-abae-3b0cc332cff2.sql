
CREATE TABLE public.diagnostic_entree (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  eleve_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competence TEXT NOT NULL,
  sous_item TEXT NOT NULL,
  score NUMERIC NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  niveau_difficulte NUMERIC GENERATED ALWAYS AS (ROUND(score / 10)) STORED,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  formateur_id UUID NOT NULL REFERENCES public.profiles(id),
  UNIQUE(eleve_id, competence, sous_item)
);

ALTER TABLE public.diagnostic_entree ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs manage own diagnostics"
ON public.diagnostic_entree FOR ALL
TO public
USING (formateur_id = auth.uid())
WITH CHECK (formateur_id = auth.uid());

CREATE POLICY "Eleves view own diagnostics"
ON public.diagnostic_entree FOR SELECT
TO public
USING (eleve_id = auth.uid());

CREATE POLICY "Formateurs view student diagnostics"
ON public.diagnostic_entree FOR SELECT
TO public
USING (eleve_id IN (
  SELECT gm.eleve_id FROM group_members gm
  JOIN groups g ON g.id = gm.group_id
  WHERE g.formateur_id = auth.uid()
));
