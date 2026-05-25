-- ============================================================
-- SPRINT 3 — Trigger de détection erreur_repetee + priorite_score
-- Mode Atelier IA · Primo Fluency Hub
-- ============================================================
-- Logique :
--   Après chaque INSERT de type reponse_incorrecte avec type_erreur_id :
--   1. Compte les occurrences du même type pour (session_id, eleve_id) dans 10 min.
--   2. Calcule facteur_repetition = min(2.5, 1 + 0.3 × (n-1)).
--   3. Met à jour priorite_score sur la ligne fraîche (gravite × besoin_humain × facteur).
--   4. Si c'est exactement la 3e occurrence, insère un événement erreur_repetee.
--
-- SECURITY DEFINER : le trigger tourne avec les droits du propriétaire
-- pour bypasser RLS sur UPDATE et sur l'INSERT système de erreur_repetee.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION detect_erreur_repetee()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count          int;
  v_facteur        numeric;
  v_gravite        int;
  v_besoin_humain  int;
  v_priorite       numeric;
BEGIN
  -- Uniquement pour les erreurs classifiées
  IF NEW.event_type <> 'reponse_incorrecte'
     OR NEW.type_erreur_id IS NULL
     OR NEW.eleve_id IS NULL
  THEN
    RETURN NEW;
  END IF;

  -- 1. Compte les occurrences dans la fenêtre de 10 min
  --    (NEW est déjà inséré, donc il est compté)
  SELECT COUNT(*) INTO v_count
  FROM session_live_events
  WHERE session_id    = NEW.session_id
    AND eleve_id      = NEW.eleve_id
    AND type_erreur_id = NEW.type_erreur_id
    AND event_type    = 'reponse_incorrecte'
    AND created_at   >= NOW() - INTERVAL '10 minutes';

  -- 2. facteur_repetition : 1 + 0.3 × (n − 1), plafonné à 2.5
  v_facteur := LEAST(2.5, 1.0 + 0.3 * (v_count - 1));

  -- 3. Paramètres de la taxonomie
  SELECT
    COALESCE(gravite_base, 2),
    COALESCE(besoin_humain_base, 0)
  INTO v_gravite, v_besoin_humain
  FROM types_erreur
  WHERE id = NEW.type_erreur_id;

  -- 4. priorite de base = gravite × besoin_humain × facteur
  --    (poids_palier et freshness_factor sont appliqués côté Sprint 4)
  v_priorite := v_gravite * v_besoin_humain * v_facteur;

  -- 5. Mise à jour de la ligne fraîche
  UPDATE session_live_events
  SET priorite_score = v_priorite
  WHERE id = NEW.id;

  -- 6. Insertion erreur_repetee à la 3e occurrence exactement
  IF v_count = 3 THEN
    INSERT INTO session_live_events (
      session_id, eleve_id, event_type, type_erreur_id, priorite_score, payload
    )
    VALUES (
      NEW.session_id,
      NEW.eleve_id,
      'erreur_repetee',
      NEW.type_erreur_id,
      v_priorite,
      jsonb_build_object(
        'occurrences',        v_count,
        'facteur_repetition', v_facteur,
        'gravite',            v_gravite
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_erreur_repetee ON session_live_events;
CREATE TRIGGER trg_detect_erreur_repetee
  AFTER INSERT ON session_live_events
  FOR EACH ROW
  EXECUTE FUNCTION detect_erreur_repetee();

COMMIT;
