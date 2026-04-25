CREATE OR REPLACE FUNCTION public.cleanup_previous_session_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _eleve_ids uuid[];
  _prev_session_ids uuid[];
BEGIN
  -- Récupère les élèves du groupe
  SELECT array_agg(eleve_id) INTO _eleve_ids
  FROM public.group_members
  WHERE group_id = NEW.group_id;

  -- Récupère les séances précédentes du même groupe (toutes sauf la nouvelle)
  SELECT array_agg(id) INTO _prev_session_ids
  FROM public.sessions
  WHERE group_id = NEW.group_id AND id <> NEW.id;

  -- Archive les devoirs en_attente des élèves du groupe
  IF _eleve_ids IS NOT NULL AND array_length(_eleve_ids, 1) > 0 THEN
    UPDATE public.devoirs
    SET statut = 'archive'::devoir_statut,
        archived_at = now(),
        archived_reason = 'nouvelle_seance'
    WHERE eleve_id = ANY(_eleve_ids)
      AND statut = 'en_attente'::devoir_statut;
  END IF;

  -- Archive les bilan_tests non passés des séances précédentes
  IF _prev_session_ids IS NOT NULL AND array_length(_prev_session_ids, 1) > 0 THEN
    UPDATE public.bilan_tests
    SET statut = 'archive',
        archived_at = now(),
        archived_reason = 'nouvelle_seance'
    WHERE session_id = ANY(_prev_session_ids)
      AND statut IN ('pret', 'envoye');

    -- Archive les bilans post-devoirs non lus des séances précédentes
    UPDATE public.bilan_post_devoirs
    SET archived_at = now(),
        archived_reason = 'nouvelle_seance'
    WHERE session_id = ANY(_prev_session_ids)
      AND is_read = false
      AND archived_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_previous_session ON public.sessions;
CREATE TRIGGER trg_cleanup_previous_session
AFTER INSERT ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_previous_session_items();