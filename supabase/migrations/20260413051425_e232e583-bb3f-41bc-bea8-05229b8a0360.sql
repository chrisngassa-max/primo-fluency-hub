
CREATE TABLE public.session_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  eleve_id uuid NOT NULL,
  difficulte_percue smallint NOT NULL CHECK (difficulte_percue BETWEEN 1 AND 3),
  confiance smallint NOT NULL CHECK (confiance BETWEEN 1 AND 3),
  utilite_percue smallint NOT NULL CHECK (utilite_percue BETWEEN 1 AND 3),
  commentaire_libre text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, eleve_id)
);

ALTER TABLE public.session_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Eleves insert own feedback"
  ON public.session_feedback FOR INSERT
  TO authenticated
  WITH CHECK (eleve_id = auth.uid());

CREATE POLICY "Eleves view own feedback"
  ON public.session_feedback FOR SELECT
  TO authenticated
  USING (eleve_id = auth.uid());

CREATE POLICY "Formateurs view session feedback"
  ON public.session_feedback FOR SELECT
  TO authenticated
  USING (get_session_formateur(session_id) = auth.uid());
