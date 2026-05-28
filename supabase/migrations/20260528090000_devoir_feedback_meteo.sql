-- Meteo eleve post-devoir: auto-evaluation courte du ressenti de difficulte.
CREATE TABLE IF NOT EXISTS public.devoir_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  devoir_id uuid NOT NULL REFERENCES public.devoirs(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercice_id uuid REFERENCES public.exercices(id) ON DELETE SET NULL,
  score numeric(5,2) CHECK (score BETWEEN 0 AND 100),
  difficulty_felt text NOT NULL CHECK (difficulty_felt IN ('facile', 'correct', 'trop_difficile')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(devoir_id, eleve_id)
);

CREATE INDEX IF NOT EXISTS idx_devoir_feedback_eleve_created
  ON public.devoir_feedback(eleve_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_devoir_feedback_devoir
  ON public.devoir_feedback(devoir_id);

ALTER TABLE public.devoir_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "eleves_manage_own_devoir_feedback" ON public.devoir_feedback;
CREATE POLICY "eleves_manage_own_devoir_feedback"
  ON public.devoir_feedback
  FOR ALL
  USING (eleve_id = auth.uid())
  WITH CHECK (
    eleve_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.devoirs d
      WHERE d.id = devoir_feedback.devoir_id
        AND d.eleve_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "formateurs_read_devoir_feedback" ON public.devoir_feedback;
CREATE POLICY "formateurs_read_devoir_feedback"
  ON public.devoir_feedback
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.devoirs d
      WHERE d.id = devoir_feedback.devoir_id
        AND d.formateur_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.set_devoir_feedback_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_devoir_feedback_updated_at ON public.devoir_feedback;
CREATE TRIGGER trg_devoir_feedback_updated_at
BEFORE UPDATE ON public.devoir_feedback
FOR EACH ROW
EXECUTE FUNCTION public.set_devoir_feedback_updated_at();
