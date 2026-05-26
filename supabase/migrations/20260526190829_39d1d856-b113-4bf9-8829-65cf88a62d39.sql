BEGIN;

ALTER TABLE session_live_events
  DROP CONSTRAINT IF EXISTS session_live_events_event_type_check;

ALTER TABLE session_live_events
  ADD CONSTRAINT session_live_events_event_type_check
  CHECK (event_type IN (
    'exercice_demarre','reponse_correcte','reponse_incorrecte',
    'erreur_repetee','rythme_anormal','exercice_termine',
    'aide_demandee','intervention_recue','fiche_terminee',
    'inactif','clic_aleatoire_probable','session_state_change',
    'eleve_state_change','niveau_recalibre'
  ));

CREATE TABLE IF NOT EXISTS public.recalibrages_niveau (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id       uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  session_id     uuid REFERENCES sessions(id) ON DELETE SET NULL,
  competence     text NOT NULL CHECK (competence IN ('CO','CE','EO','EE')),
  niveau_avant   text NOT NULL,
  niveau_apres   text NOT NULL,
  raison         text NOT NULL DEFAULT 'erreurs_repetees',
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recalibrages_eleve
  ON public.recalibrages_niveau (eleve_id, created_at DESC);

GRANT SELECT ON public.recalibrages_niveau TO authenticated;
GRANT ALL ON public.recalibrages_niveau TO service_role;

ALTER TABLE public.recalibrages_niveau ENABLE ROW LEVEL SECURITY;

CREATE POLICY recalibrages_select_eleve ON public.recalibrages_niveau
  FOR SELECT TO authenticated USING (eleve_id = auth.uid());

CREATE POLICY recalibrages_select_formateur ON public.recalibrages_niveau
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM groups g
      JOIN group_members gm ON gm.group_id = g.id
      WHERE g.formateur_id = auth.uid() AND gm.eleve_id = recalibrages_niveau.eleve_id
    )
  );

CREATE OR REPLACE FUNCTION public.descendre_niveau(v_niveau text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE v_niveau
    WHEN 'B2' THEN 'B1'
    WHEN 'B1' THEN 'A2'
    WHEN 'A2' THEN 'A1'
    WHEN 'A1' THEN 'A0'
    ELSE v_niveau
  END;
$$;

CREATE OR REPLACE FUNCTION public.auto_recalibrage_niveau()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competence      text;
  v_niveau_avant    text;
  v_niveau_apres    text;
  v_count_repetees  int;
  v_col_niveau      text;
BEGIN
  IF NEW.event_type <> 'erreur_repetee' OR NEW.eleve_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_competence := COALESCE(NEW.competence,
    (SELECT (competences)[1] FROM types_erreur WHERE id = NEW.type_erreur_id));

  IF v_competence IS NULL OR v_competence NOT IN ('CO','CE','EO','EE') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count_repetees
  FROM session_live_events
  WHERE eleve_id = NEW.eleve_id
    AND type_erreur_id = NEW.type_erreur_id
    AND event_type = 'erreur_repetee';

  IF v_count_repetees = 0 OR v_count_repetees % 3 <> 0 THEN RETURN NEW; END IF;

  v_col_niveau := 'niveau_' || lower(v_competence);

  EXECUTE format(
    'SELECT %I FROM profils_eleves WHERE eleve_id = $1', v_col_niveau
  ) INTO v_niveau_avant USING NEW.eleve_id;

  IF v_niveau_avant IS NULL THEN RETURN NEW; END IF;

  v_niveau_apres := descendre_niveau(v_niveau_avant);

  IF v_niveau_apres = v_niveau_avant THEN RETURN NEW; END IF;

  EXECUTE format(
    'UPDATE profils_eleves SET %I = $1, niveau_source = $2, niveau_updated_at = now()
     WHERE eleve_id = $3', v_col_niveau
  ) USING v_niveau_apres, 'recalibrage_auto', NEW.eleve_id;

  INSERT INTO recalibrages_niveau
    (eleve_id, session_id, competence, niveau_avant, niveau_apres, raison)
  VALUES
    (NEW.eleve_id, NEW.session_id, v_competence,
     v_niveau_avant, v_niveau_apres, 'erreurs_repetees_' || COALESCE(NEW.type_erreur_id,'inconnu'));

  INSERT INTO session_live_events
    (session_id, eleve_id, event_type, type_erreur_id, competence, payload)
  VALUES (
    NEW.session_id, NEW.eleve_id, 'niveau_recalibre', NEW.type_erreur_id, v_competence,
    jsonb_build_object(
      'competence',    v_competence,
      'niveau_avant',  v_niveau_avant,
      'niveau_apres',  v_niveau_apres,
      'auto',          true
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_recalibrage ON session_live_events;
CREATE TRIGGER trg_auto_recalibrage
  AFTER INSERT ON session_live_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_recalibrage_niveau();

COMMIT;