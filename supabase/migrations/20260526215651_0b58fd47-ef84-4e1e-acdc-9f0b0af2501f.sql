CREATE OR REPLACE FUNCTION monter_niveau(v_niveau text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE v_niveau
    WHEN 'A0' THEN 'A1'
    WHEN 'A1' THEN 'A2'
    WHEN 'A2' THEN 'B1'
    WHEN 'B1' THEN 'B2'
    ELSE v_niveau
  END;
$$;

CREATE OR REPLACE FUNCTION auto_recalibrage_montant()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_competence   text;
  v_niveau_avant text;
  v_niveau_apres text;
  v_count        int;
BEGIN
  IF NEW.event_type <> 'reponse_correcte'
     OR NEW.type_erreur_id IS NULL
     OR NEW.eleve_id IS NULL
  THEN RETURN NEW; END IF;

  SELECT COUNT(*) INTO v_count
  FROM session_live_events
  WHERE session_id     = NEW.session_id
    AND eleve_id       = NEW.eleve_id
    AND type_erreur_id = NEW.type_erreur_id
    AND event_type     = 'reponse_correcte'
    AND created_at    >= NOW() - INTERVAL '30 minutes';

  IF v_count % 5 <> 0 THEN RETURN NEW; END IF;

  v_competence := COALESCE(NEW.competence,
    (SELECT (competences)[1] FROM types_erreur WHERE id = NEW.type_erreur_id));

  IF v_competence IS NULL THEN RETURN NEW; END IF;

  EXECUTE format(
    'SELECT %I FROM profils_eleves WHERE eleve_id = $1',
    'niveau_' || lower(v_competence)
  ) INTO v_niveau_avant USING NEW.eleve_id;

  v_niveau_apres := monter_niveau(v_niveau_avant);

  IF v_niveau_apres = v_niveau_avant THEN RETURN NEW; END IF;

  EXECUTE format(
    'UPDATE profils_eleves SET %I = $1, niveau_source = $2, niveau_updated_at = now()
     WHERE eleve_id = $3',
    'niveau_' || lower(v_competence)
  ) USING v_niveau_apres, 'recalibrage_auto', NEW.eleve_id;

  INSERT INTO recalibrages_niveau
    (eleve_id, session_id, competence, niveau_avant, niveau_apres, raison)
  VALUES
    (NEW.eleve_id, NEW.session_id, v_competence,
     v_niveau_avant, v_niveau_apres, 'progression_' || NEW.type_erreur_id);

  INSERT INTO session_live_events
    (session_id, eleve_id, event_type, type_erreur_id, payload)
  VALUES (
    NEW.session_id, NEW.eleve_id, 'niveau_recalibre', NEW.type_erreur_id,
    jsonb_build_object(
      'competence',   v_competence,
      'niveau_avant', v_niveau_avant,
      'niveau_apres', v_niveau_apres,
      'direction',    'montant',
      'auto',         true
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_recalibrage_montant ON session_live_events;
CREATE TRIGGER trg_recalibrage_montant
  AFTER INSERT ON session_live_events
  FOR EACH ROW
  EXECUTE FUNCTION auto_recalibrage_montant();