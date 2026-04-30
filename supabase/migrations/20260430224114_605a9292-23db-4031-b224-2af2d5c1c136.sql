-- Enums
DO $$ BEGIN
  CREATE TYPE public.session_outcome_objectif_status AS ENUM ('absent', 'non_atteint', 'a_consolider', 'atteint', 'au_dela');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE public.session_outcome_besoin AS ENUM ('rattrapage', 'remediation', 'consolidation', 'approfondissement', 'aucun');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Table
CREATE TABLE public.session_student_outcomes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL,
  eleve_id uuid NOT NULL,
  formateur_id uuid NOT NULL,
  objectif_status public.session_outcome_objectif_status,
  points_vigilance text,
  points_forts text,
  besoin_pedagogique public.session_outcome_besoin,
  devoir_recommande text,
  decision_formateur text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, eleve_id)
);

CREATE INDEX idx_sso_session ON public.session_student_outcomes(session_id);
CREATE INDEX idx_sso_eleve ON public.session_student_outcomes(eleve_id);
CREATE INDEX idx_sso_formateur ON public.session_student_outcomes(formateur_id);

-- RLS
ALTER TABLE public.session_student_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs manage own session_student_outcomes"
ON public.session_student_outcomes
FOR ALL
TO authenticated
USING (formateur_id = auth.uid() AND public.get_session_formateur(session_id) = auth.uid())
WITH CHECK (formateur_id = auth.uid() AND public.get_session_formateur(session_id) = auth.uid());

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_sso_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sso_updated_at
BEFORE UPDATE ON public.session_student_outcomes
FOR EACH ROW
EXECUTE FUNCTION public.set_sso_updated_at();