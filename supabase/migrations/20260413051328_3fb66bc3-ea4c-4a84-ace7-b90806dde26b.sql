
CREATE TABLE public.analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL,
  actor_type text NOT NULL,
  verb text NOT NULL,
  object_id text,
  object_type text,
  competence text,
  micro_competence_id uuid,
  gabarit_id uuid,
  seance_numero integer,
  context text,
  result jsonb,
  session_id uuid,
  group_id uuid,
  source_app text DEFAULT 'primo',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own events"
  ON public.analytics_events FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = auth.uid());

CREATE POLICY "Formateurs view group events"
  ON public.analytics_events FOR SELECT
  TO authenticated
  USING (
    actor_id = auth.uid()
    OR has_role(auth.uid(), 'formateur')
    OR has_role(auth.uid(), 'admin')
  );

CREATE INDEX idx_analytics_events_actor ON public.analytics_events(actor_id);
CREATE INDEX idx_analytics_events_verb ON public.analytics_events(verb);
CREATE INDEX idx_analytics_events_created ON public.analytics_events(created_at);
