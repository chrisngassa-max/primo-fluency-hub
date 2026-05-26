CREATE TABLE IF NOT EXISTS public.session_exercise_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercice_index integer NOT NULL,
  variant_payload jsonb NOT NULL,
  niveau_variante text NOT NULL CHECK (niveau_variante IN ('bas', 'standard', 'haut')),
  niveau_etayage text NOT NULL CHECK (niveau_etayage IN ('fort', 'moyen', 'faible')),
  mode_adaptation text NOT NULL CHECK (mode_adaptation IN ('demarrage', 'remediation', 'consolide', 'augmente')),
  competence_cible text,
  generation_run_id uuid NOT NULL,
  generated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, eleve_id, exercice_index, generation_run_id)
);

CREATE INDEX IF NOT EXISTS idx_session_exercise_variants_session
  ON public.session_exercise_variants(session_id);

CREATE INDEX IF NOT EXISTS idx_session_exercise_variants_eleve
  ON public.session_exercise_variants(eleve_id);

CREATE INDEX IF NOT EXISTS idx_session_exercise_variants_run
  ON public.session_exercise_variants(generation_run_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_session_exercise_variants_active
  ON public.session_exercise_variants(session_id, eleve_id, exercice_index)
  WHERE is_active = true;

ALTER TABLE public.session_exercise_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eleves view own session exercise variants"
  ON public.session_exercise_variants
  FOR SELECT
  USING (eleve_id = auth.uid());

CREATE POLICY "Formateurs manage session exercise variants"
  ON public.session_exercise_variants
  FOR ALL
  USING (public.get_session_formateur(session_id) = auth.uid())
  WITH CHECK (public.get_session_formateur(session_id) = auth.uid());

CREATE POLICY "Admins manage session exercise variants"
  ON public.session_exercise_variants
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
