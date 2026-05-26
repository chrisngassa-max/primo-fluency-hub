
CREATE OR REPLACE FUNCTION public.detect_erreur_repetee()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_count int; v_facteur numeric; v_gravite int; v_besoin_humain int; v_priorite numeric;
  v_niveau text; v_competence text;
  v_intervention record;
BEGIN
  IF NEW.event_type <> 'reponse_incorrecte' OR NEW.type_erreur_id IS NULL OR NEW.eleve_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM session_live_events
  WHERE session_id = NEW.session_id AND eleve_id = NEW.eleve_id
    AND type_erreur_id = NEW.type_erreur_id AND event_type = 'reponse_incorrecte'
    AND created_at >= NOW() - INTERVAL '10 minutes';

  v_facteur := LEAST(2.5, 1.0 + 0.3 * (v_count - 1));
  SELECT COALESCE(gravite_base, 2), COALESCE(besoin_humain_base, 0)
    INTO v_gravite, v_besoin_humain FROM types_erreur WHERE id = NEW.type_erreur_id;
  v_priorite := v_gravite * v_besoin_humain * v_facteur;
  UPDATE session_live_events SET priorite_score = v_priorite WHERE id = NEW.id;

  IF v_count = 3 THEN
    INSERT INTO session_live_events (session_id, eleve_id, event_type, type_erreur_id, priorite_score, payload, competence)
    VALUES (NEW.session_id, NEW.eleve_id, 'erreur_repetee', NEW.type_erreur_id, v_priorite,
      jsonb_build_object('occurrences', v_count, 'facteur_repetition', v_facteur, 'gravite', v_gravite),
      NEW.competence);

    -- Récupère niveau élève (fallback A1)
    SELECT COALESCE(niveau_actuel, 'A1') INTO v_niveau
    FROM profils_eleves WHERE eleve_id = NEW.eleve_id LIMIT 1;
    IF v_niveau IS NULL THEN v_niveau := 'A1'; END IF;

    v_competence := NEW.competence;

    -- Cherche intervention système : match exact niveau+compétence, sinon fallback compétence seule, sinon type_erreur seul
    SELECT id, contenu_texte, audio_url, titre INTO v_intervention
    FROM interventions
    WHERE is_systeme = true
      AND type_erreur_id = NEW.type_erreur_id
      AND (v_competence IS NULL OR competence = v_competence OR competence IS NULL)
      AND (niveau_cible = v_niveau OR niveau_cible IS NULL)
    ORDER BY
      (niveau_cible = v_niveau)::int DESC,
      (competence = v_competence)::int DESC
    LIMIT 1;

    IF v_intervention.id IS NOT NULL THEN
      INSERT INTO session_live_events (session_id, eleve_id, event_type, type_erreur_id, payload, competence)
      VALUES (NEW.session_id, NEW.eleve_id, 'intervention_recue', NEW.type_erreur_id,
        jsonb_build_object(
          'intervention_id', v_intervention.id,
          'titre', v_intervention.titre,
          'texte', v_intervention.contenu_texte,
          'audio_url', v_intervention.audio_url,
          'auto_dispatch', true,
          'niveau', v_niveau
        ),
        v_competence);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
