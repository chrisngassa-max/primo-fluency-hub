-- Table: homework_generation_queue
CREATE TABLE IF NOT EXISTS public.homework_generation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL,
  formateur_id uuid NOT NULL,
  session_id uuid NULL,
  completed_serie integer NULL,
  status text NOT NULL DEFAULT 'pending',
  reason text NOT NULL DEFAULT 'serie_completed',
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL,
  CONSTRAINT homework_queue_status_check CHECK (status IN ('pending','processing','done','failed'))
);

-- Index unique partiel : pas deux entrées actives pour même élève + série terminée
CREATE UNIQUE INDEX IF NOT EXISTS uniq_homework_generation_queue_active
  ON public.homework_generation_queue(eleve_id, completed_serie)
  WHERE status IN ('pending', 'processing');

-- Index de récupération
CREATE INDEX IF NOT EXISTS idx_homework_queue_pickup
  ON public.homework_generation_queue(status, next_attempt_at)
  WHERE status IN ('pending', 'failed');

-- Index perf devoirs
CREATE INDEX IF NOT EXISTS idx_devoirs_eleve_serie_statut
  ON public.devoirs(eleve_id, serie, statut);

-- RLS
ALTER TABLE public.homework_generation_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service role manages queue" ON public.homework_generation_queue;
CREATE POLICY "service role manages queue"
  ON public.homework_generation_queue
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "formateurs view own queue" ON public.homework_generation_queue;
CREATE POLICY "formateurs view own queue"
  ON public.homework_generation_queue
  FOR SELECT
  USING (formateur_id = auth.uid());

-- Trigger AFTER UPDATE ON devoirs : planifier la prochaine série
CREATE OR REPLACE FUNCTION public.enqueue_next_homework_series()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _remaining int;
  _completed_serie int;
BEGIN
  -- On ne planifie que sur transition vers 'fait'
  IF NEW.statut = 'fait' AND (OLD.statut IS DISTINCT FROM NEW.statut) THEN
    _completed_serie := COALESCE(NEW.serie, 0);

    -- Vérifier qu'aucun devoir de cette série n'est encore en_attente pour cet élève
    SELECT count(*) INTO _remaining
    FROM public.devoirs
    WHERE eleve_id = NEW.eleve_id
      AND COALESCE(serie, 0) = _completed_serie
      AND statut = 'en_attente';

    IF _remaining = 0 THEN
      -- Idempotence via index unique partiel
      INSERT INTO public.homework_generation_queue (
        eleve_id, formateur_id, session_id, completed_serie, reason
      ) VALUES (
        NEW.eleve_id, NEW.formateur_id, NEW.session_id, _completed_serie, 'serie_completed'
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_next_homework_series ON public.devoirs;
CREATE TRIGGER trg_enqueue_next_homework_series
  AFTER UPDATE ON public.devoirs
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_next_homework_series();