
-- Create bilan_tests table
CREATE TABLE public.bilan_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  formateur_id uuid NOT NULL REFERENCES public.profiles(id),
  statut text NOT NULL DEFAULT 'pret',
  contenu jsonb NOT NULL DEFAULT '[]'::jsonb,
  competences_couvertes text[] NOT NULL DEFAULT '{}'::text[],
  nb_questions integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bilan_tests ENABLE ROW LEVEL SECURITY;

-- Formateurs manage their own bilan tests
CREATE POLICY "Formateurs manage own bilan_tests"
  ON public.bilan_tests FOR ALL
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());

-- Eleves can view sent bilan tests for their groups
CREATE POLICY "Eleves view sent bilan_tests"
  ON public.bilan_tests FOR SELECT
  USING (
    statut = 'envoye' AND
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN group_members gm ON gm.group_id = s.group_id
      WHERE gm.eleve_id = auth.uid()
    )
  );

-- Create bilan_test_results table
CREATE TABLE public.bilan_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bilan_test_id uuid NOT NULL REFERENCES public.bilan_tests(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL REFERENCES public.profiles(id),
  score_global numeric NOT NULL DEFAULT 0,
  scores_par_competence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reponses jsonb NOT NULL DEFAULT '{}'::jsonb,
  correction jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(bilan_test_id, eleve_id)
);

ALTER TABLE public.bilan_test_results ENABLE ROW LEVEL SECURITY;

-- Eleves manage own results
CREATE POLICY "Eleves manage own bilan_test_results"
  ON public.bilan_test_results FOR ALL
  USING (eleve_id = auth.uid())
  WITH CHECK (eleve_id = auth.uid());

-- Formateurs view results for their tests
CREATE POLICY "Formateurs view bilan_test_results"
  ON public.bilan_test_results FOR SELECT
  USING (
    bilan_test_id IN (
      SELECT id FROM public.bilan_tests WHERE formateur_id = auth.uid()
    )
  );
