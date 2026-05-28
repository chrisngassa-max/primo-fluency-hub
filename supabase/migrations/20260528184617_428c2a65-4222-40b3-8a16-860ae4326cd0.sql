
CREATE OR REPLACE FUNCTION public.touch_devoir_feedback_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.devoir_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devoir_id uuid NOT NULL REFERENCES public.devoirs(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercice_id uuid REFERENCES public.exercices(id) ON DELETE SET NULL,
  score numeric(5,2) CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
  difficulty_felt text NOT NULL CHECK (difficulty_felt IN ('facile', 'correct', 'trop_difficile')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (devoir_id, eleve_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.devoir_feedback TO authenticated;
GRANT ALL ON public.devoir_feedback TO service_role;

ALTER TABLE public.devoir_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eleve can view own feedback"
ON public.devoir_feedback FOR SELECT TO authenticated
USING (
  eleve_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.devoirs d WHERE d.id = devoir_id AND d.eleve_id = auth.uid())
);

CREATE POLICY "Eleve can insert own feedback"
ON public.devoir_feedback FOR INSERT TO authenticated
WITH CHECK (
  eleve_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.devoirs d WHERE d.id = devoir_id AND d.eleve_id = auth.uid())
);

CREATE POLICY "Eleve can update own feedback"
ON public.devoir_feedback FOR UPDATE TO authenticated
USING (
  eleve_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.devoirs d WHERE d.id = devoir_id AND d.eleve_id = auth.uid())
)
WITH CHECK (
  eleve_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.devoirs d WHERE d.id = devoir_id AND d.eleve_id = auth.uid())
);

CREATE POLICY "Eleve can delete own feedback"
ON public.devoir_feedback FOR DELETE TO authenticated
USING (
  eleve_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.devoirs d WHERE d.id = devoir_id AND d.eleve_id = auth.uid())
);

CREATE POLICY "Formateur can read feedback for own devoirs"
ON public.devoir_feedback FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.devoirs d WHERE d.id = devoir_id AND d.formateur_id = auth.uid())
);

CREATE POLICY "Admin can read all feedback"
ON public.devoir_feedback FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_devoir_feedback_eleve ON public.devoir_feedback(eleve_id, created_at DESC);
CREATE INDEX idx_devoir_feedback_devoir ON public.devoir_feedback(devoir_id);

CREATE TRIGGER trg_devoir_feedback_updated_at
BEFORE UPDATE ON public.devoir_feedback
FOR EACH ROW
EXECUTE FUNCTION public.touch_devoir_feedback_updated_at();
