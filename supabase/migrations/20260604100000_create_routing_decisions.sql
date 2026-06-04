BEGIN;

CREATE TABLE IF NOT EXISTS public.routing_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  formateur_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id uuid REFERENCES public.sessions(id) ON DELETE CASCADE,
  exercice_id uuid REFERENCES public.exercices(id) ON DELETE SET NULL,
  competence text NOT NULL CHECK (competence IN ('CO','CE','EE','EO')),
  phase text NOT NULL CHECK (phase IN ('phase2_tronc_commun','phase3_atelier','phase5_devoir')),
  rule_id text NOT NULL,
  decision text NOT NULL,
  devoir_genere text,
  reason_student text NOT NULL,
  reason_trainer text NOT NULL,
  context_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  modified_by_trainer boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_eleve_created
  ON public.routing_decisions(eleve_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_formateur_created
  ON public.routing_decisions(formateur_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_session
  ON public.routing_decisions(session_id);

CREATE INDEX IF NOT EXISTS idx_routing_decisions_phase_rule
  ON public.routing_decisions(phase, rule_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.routing_decisions TO authenticated;
GRANT ALL ON public.routing_decisions TO service_role;

ALTER TABLE public.routing_decisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Eleves view own routing decisions" ON public.routing_decisions;
CREATE POLICY "Eleves view own routing decisions"
  ON public.routing_decisions
  FOR SELECT
  TO authenticated
  USING (eleve_id = auth.uid());

DROP POLICY IF EXISTS "Formateurs manage own routing decisions" ON public.routing_decisions;
CREATE POLICY "Formateurs manage own routing decisions"
  ON public.routing_decisions
  FOR ALL
  TO authenticated
  USING (
    formateur_id = auth.uid()
    OR (
      session_id IS NOT NULL
      AND public.get_session_formateur(session_id) = auth.uid()
    )
  )
  WITH CHECK (
    formateur_id = auth.uid()
    OR (
      session_id IS NOT NULL
      AND public.get_session_formateur(session_id) = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins manage routing decisions" ON public.routing_decisions;
CREATE POLICY "Admins manage routing decisions"
  ON public.routing_decisions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

COMMIT;
