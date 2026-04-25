-- Colonnes IA pour exercise_reports
ALTER TABLE public.exercise_reports
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb,
  ADD COLUMN IF NOT EXISTS ai_problem_type text, -- contenu | technique | pedagogique | inconnu
  ADD COLUMN IF NOT EXISTS ai_proposed_solution jsonb,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric, -- 0..1
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_auto_applied boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_applied_at timestamptz,
  ADD COLUMN IF NOT EXISTS formateur_decision text, -- pending | confirmed | reverted
  ADD COLUMN IF NOT EXISTS formateur_decision_at timestamptz,
  ADD COLUMN IF NOT EXISTS exercice_snapshot jsonb; -- snapshot avant modif

CREATE INDEX IF NOT EXISTS idx_exercise_reports_processed
  ON public.exercise_reports(formateur_id, ai_processed_at);

-- Table des rapports quotidiens
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_id uuid NOT NULL,
  report_date date NOT NULL,
  kind text NOT NULL DEFAULT 'morning', -- morning | evening
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  total_reports integer NOT NULL DEFAULT 0,
  auto_applied integer NOT NULL DEFAULT 0,
  pending_validation integer NOT NULL DEFAULT 0,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (formateur_id, report_date, kind)
);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Formateurs view own daily_reports"
  ON public.daily_reports FOR SELECT TO authenticated
  USING (formateur_id = auth.uid());

CREATE POLICY "Formateurs update own daily_reports"
  ON public.daily_reports FOR UPDATE TO authenticated
  USING (formateur_id = auth.uid())
  WITH CHECK (formateur_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_daily_reports_formateur_date
  ON public.daily_reports(formateur_id, report_date DESC);