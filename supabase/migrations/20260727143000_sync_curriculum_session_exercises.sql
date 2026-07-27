-- Synchronise en une transaction la sélection curriculum d'une séance.
-- Les exercices non-curriculum et les affectations individuelles sont préservés.
CREATE OR REPLACE FUNCTION public.sync_curriculum_session_exercises(
  p_session_id uuid,
  p_exercise_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted integer := 0;
BEGIN
  IF auth.uid() IS NULL
     OR public.get_session_formateur(p_session_id) IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Accès refusé à cette séance';
  END IF;

  IF COALESCE(array_length(p_exercise_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'La sélection curriculum ne peut pas être vide';
  END IF;

  IF (
    SELECT count(*) <> count(DISTINCT exercise_id)
    FROM unnest(p_exercise_ids) AS selected(exercise_id)
  ) THEN
    RAISE EXCEPTION 'La sélection curriculum contient des doublons';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM unnest(p_exercise_ids) AS selected(exercise_id)
    LEFT JOIN public.exercices e ON e.id = selected.exercise_id
    WHERE e.id IS NULL
       OR e.source IS DISTINCT FROM 'curriculum_v2'
       OR e.is_template
       OR e.eleve_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'La sélection contient un exercice hors curriculum publiable';
  END IF;

  DELETE FROM public.session_exercices se
  USING public.exercices e
  WHERE se.session_id = p_session_id
    AND se.exercice_id = e.id
    AND se.eleve_id IS NULL
    AND e.source = 'curriculum_v2';

  INSERT INTO public.session_exercices (
    session_id,
    exercice_id,
    ordre,
    statut,
    bloc
  )
  SELECT
    p_session_id,
    selected.exercise_id,
    selected.ordre::integer,
    'planifie'::public.session_exercice_statut,
    'core'
  FROM unnest(p_exercise_ids) WITH ORDINALITY AS selected(exercise_id, ordre);

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_curriculum_session_exercises(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_curriculum_session_exercises(uuid, uuid[]) TO authenticated;