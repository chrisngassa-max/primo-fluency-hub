CREATE OR REPLACE FUNCTION public.validate_pedagogical_source_transcription_review(
  p_transcription_id uuid,
  p_reviewed_text text,
  p_segments jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_trainer boolean := public.has_role(v_user_id, 'formateur'::public.app_role);
  v_is_admin boolean := public.has_role(v_user_id, 'admin'::public.app_role);
  v_source_id uuid;
  v_source_owner uuid;
  v_segment_count integer;
  v_payload_count integer;
  v_published_family_count integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  IF NOT v_is_trainer AND NOT v_is_admin THEN
    RAISE EXCEPTION 'STAFF_ROLE_REQUIRED';
  END IF;

  IF p_transcription_id IS NULL THEN
    RAISE EXCEPTION 'TRANSCRIPTION_ID_REQUIRED';
  END IF;

  IF p_reviewed_text IS NULL OR btrim(p_reviewed_text) = '' THEN
    RAISE EXCEPTION 'TRANSCRIPTION_REVIEW_TEXT_REQUIRED';
  END IF;

  IF p_segments IS NULL
     OR jsonb_typeof(p_segments) <> 'array'
     OR jsonb_array_length(p_segments) = 0 THEN
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_REQUIRED';
  END IF;

  SELECT transcription.source_id, source.created_by
  INTO v_source_id, v_source_owner
  FROM public.pedagogical_source_transcriptions AS transcription
  JOIN public.pedagogical_sources AS source
    ON source.id = transcription.source_id
  WHERE transcription.id = p_transcription_id
    AND transcription.is_current = true
  FOR UPDATE;

  IF v_source_id IS NULL THEN
    RAISE EXCEPTION 'TRANSCRIPTION_NOT_FOUND';
  END IF;

  IF NOT v_is_admin AND v_source_owner IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'SOURCE_FORBIDDEN';
  END IF;

  WITH normalized_segments AS (
    SELECT
      (entry->>'id')::uuid AS id,
      btrim(coalesce(entry->>'reviewed_text', '')) AS reviewed_text
    FROM jsonb_array_elements(p_segments) AS entry
  )
  SELECT count(*)
  INTO v_payload_count
  FROM normalized_segments;

  IF EXISTS (
    WITH normalized_segments AS (
      SELECT
        (entry->>'id')::uuid AS id,
        btrim(coalesce(entry->>'reviewed_text', '')) AS reviewed_text
      FROM jsonb_array_elements(p_segments) AS entry
    )
    SELECT 1
    FROM normalized_segments
    WHERE id IS NULL OR reviewed_text = ''
  ) THEN
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_INVALID';
  END IF;

  IF EXISTS (
    WITH normalized_segments AS (
      SELECT (entry->>'id')::uuid AS id
      FROM jsonb_array_elements(p_segments) AS entry
    )
    SELECT id
    FROM normalized_segments
    GROUP BY id
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_DUPLICATED';
  END IF;

  SELECT count(*)
  INTO v_segment_count
  FROM public.pedagogical_source_transcription_segments
  WHERE transcription_id = p_transcription_id;

  IF v_segment_count <> v_payload_count THEN
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_INCOMPLETE';
  END IF;

  IF EXISTS (
    WITH normalized_segments AS (
      SELECT (entry->>'id')::uuid AS id
      FROM jsonb_array_elements(p_segments) AS entry
    )
    SELECT 1
    FROM normalized_segments AS payload
    LEFT JOIN public.pedagogical_source_transcription_segments AS segment
      ON segment.id = payload.id
     AND segment.transcription_id = p_transcription_id
    WHERE segment.id IS NULL
  ) THEN
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_MISMATCH';
  END IF;

  WITH normalized_segments AS (
    SELECT
      (entry->>'id')::uuid AS id,
      btrim(entry->>'reviewed_text') AS reviewed_text
    FROM jsonb_array_elements(p_segments) AS entry
  )
  UPDATE public.pedagogical_source_transcription_segments AS segment
  SET reviewed_text = normalized_segments.reviewed_text
  FROM normalized_segments
  WHERE segment.id = normalized_segments.id
    AND segment.transcription_id = p_transcription_id;

  UPDATE public.pedagogical_source_transcriptions
  SET reviewed_text = btrim(p_reviewed_text),
      reviewed_at = now(),
      reviewed_by = v_user_id,
      status = 'reviewed'
  WHERE id = p_transcription_id;

  DELETE FROM public.pedagogical_source_chunks
  WHERE source_id = v_source_id;

  SELECT count(*)
  INTO v_published_family_count
  FROM public.differentiation_families
  WHERE source_id = v_source_id
    AND review_status = 'published';

  UPDATE public.pedagogical_sources
  SET status = 'imported',
      review_status = CASE
        WHEN v_published_family_count > 0 THEN 'a_remplacer'
        ELSE review_status
      END,
      metadata = coalesce(metadata, '{}'::jsonb)
        || jsonb_build_object(
          'transcription_review_validated_at', to_jsonb(now()),
          'transcription_review_requires_reanalysis', true,
          'published_source_stale', v_published_family_count > 0
        )
        || CASE
          WHEN v_published_family_count > 0
            THEN jsonb_build_object('published_source_stale_at', to_jsonb(now()))
          ELSE '{}'::jsonb
        END
  WHERE id = v_source_id;

  -- Marque les exercices publiés liés comme obsolètes sans les supprimer.
  -- La famille reste `published` et l'exercice reste traçable.
  UPDATE public.exercices AS exercise
  SET contenu = coalesce(exercise.contenu, '{}'::jsonb)
    || jsonb_build_object(
      'metadata',
      coalesce(exercise.contenu->'metadata', '{}'::jsonb)
        || jsonb_build_object(
          'source_stale', true,
          'source_stale_at', to_jsonb(now())
        )
    )
  FROM public.differentiation_families AS family
  WHERE family.source_id = v_source_id
    AND family.review_status = 'published'
    AND family.published_exercise_id = exercise.id;

  UPDATE public.differentiation_families
  SET review_status = 'archived'
  WHERE source_id = v_source_id
    AND review_status <> 'published';

  RETURN jsonb_build_object(
    'ok', true,
    'source_id', v_source_id,
    'published_family_count', v_published_family_count
  );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.validate_pedagogical_source_transcription_review(uuid, text, jsonb)
  TO authenticated, service_role;
