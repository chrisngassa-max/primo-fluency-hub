CREATE OR REPLACE FUNCTION public.recalculate_score_risque()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _eleve_id uuid;
  _seuil_consolidation numeric;
  _alerte_absence_heures integer;
  _seuil_score_risque numeric;
  _score_absence numeric;
  _score_devoirs_expires numeric;
  _score_tendance numeric;
  _score_critique numeric;
  _score_risque numeric;
  _last_login timestamptz;
  _total_devoirs integer;
  _expired_devoirs integer;
  _recent_scores numeric[];
  _old_scores numeric[];
  _formateur_id uuid;
BEGIN
  _eleve_id := NEW.eleve_id;

  -- Get formateur from group membership
  SELECT g.formateur_id INTO _formateur_id
  FROM group_members gm JOIN groups g ON g.id = gm.group_id
  WHERE gm.eleve_id = _eleve_id LIMIT 1;

  IF _formateur_id IS NULL THEN RETURN NEW; END IF;

  SELECT COALESCE(p.seuil_consolidation, 60), COALESCE(p.alerte_absence_heures, 48), COALESCE(p.seuil_score_risque, 60)
  INTO _seuil_consolidation, _alerte_absence_heures, _seuil_score_risque
  FROM parametres p WHERE p.formateur_id = _formateur_id;

  IF NOT FOUND THEN
    _seuil_consolidation := 60; _alerte_absence_heures := 48; _seuil_score_risque := 60;
  END IF;

  SELECT last_login INTO _last_login FROM profiles WHERE id = _eleve_id;
  IF _last_login IS NULL THEN _score_absence := 100;
  ELSE _score_absence := LEAST(100, EXTRACT(EPOCH FROM (now() - _last_login)) / 3600 / _alerte_absence_heures * 100);
  END IF;

  SELECT count(*) INTO _total_devoirs FROM devoirs WHERE eleve_id = _eleve_id;
  SELECT count(*) INTO _expired_devoirs FROM devoirs WHERE eleve_id = _eleve_id AND statut = 'expire';
  IF _total_devoirs > 0 THEN _score_devoirs_expires := (_expired_devoirs::numeric / _total_devoirs) * 100;
  ELSE _score_devoirs_expires := 0; END IF;

  -- Score tendance : EXCLURE les bonus
  SELECT array_agg(score ORDER BY created_at DESC) INTO _recent_scores
  FROM (SELECT score, created_at FROM resultats WHERE eleve_id = _eleve_id AND COALESCE(is_bonus, false) = false ORDER BY created_at DESC LIMIT 3) t;
  SELECT array_agg(score ORDER BY created_at ASC) INTO _old_scores
  FROM (SELECT score, created_at FROM resultats WHERE eleve_id = _eleve_id AND COALESCE(is_bonus, false) = false ORDER BY created_at ASC LIMIT 3) t;

  IF array_length(_recent_scores, 1) >= 3 AND array_length(_old_scores, 1) >= 3 THEN
    DECLARE avg_recent numeric; avg_old numeric;
    BEGIN
      avg_recent := (_recent_scores[1] + _recent_scores[2] + _recent_scores[3]) / 3;
      avg_old := (_old_scores[1] + _old_scores[2] + _old_scores[3]) / 3;
      IF avg_recent < avg_old THEN _score_tendance := LEAST(100, (avg_old - avg_recent) * 2);
      ELSE _score_tendance := 0; END IF;
    END;
  ELSE _score_tendance := 0; END IF;

  -- Score critique : EXCLURE les bonus
  SELECT array_agg(score ORDER BY created_at DESC) INTO _recent_scores
  FROM (SELECT score, created_at FROM resultats WHERE eleve_id = _eleve_id AND COALESCE(is_bonus, false) = false ORDER BY created_at DESC LIMIT 5) t;
  IF array_length(_recent_scores, 1) >= 5 THEN
    DECLARE avg5 numeric;
    BEGIN
      avg5 := (_recent_scores[1]+_recent_scores[2]+_recent_scores[3]+_recent_scores[4]+_recent_scores[5]) / 5;
      IF avg5 < _seuil_consolidation THEN _score_critique := 100; ELSE _score_critique := 0; END IF;
    END;
  ELSE _score_critique := 0; END IF;

  _score_risque := ROUND(0.30 * _score_absence + 0.25 * _score_devoirs_expires + 0.25 * _score_tendance + 0.20 * _score_critique);

  UPDATE profils_eleves SET score_risque = _score_risque, updated_at = now() WHERE eleve_id = _eleve_id;

  IF _score_risque >= _seuil_score_risque THEN
    INSERT INTO alertes (eleve_id, formateur_id, type, message)
    SELECT _eleve_id, _formateur_id, 'score_risque', 'Score de risque élevé : ' || _score_risque || '/100'
    WHERE NOT EXISTS (
      SELECT 1 FROM alertes WHERE eleve_id = _eleve_id AND formateur_id = _formateur_id AND type = 'score_risque' AND is_resolved = false
    );
  END IF;

  RETURN NEW;
END;
$function$;