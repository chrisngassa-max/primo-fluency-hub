BEGIN;

-- Charge la migration (BEGIN/COMMIT internes). Le bloc de fixtures reste ensuite
-- dans une transaction locale terminée par ROLLBACK.
\i supabase/migrations/20260728113000_a2_audio_review_fixes.sql

BEGIN;

DO $$
DECLARE
  v_formateur_id uuid := '10000000-0000-0000-0000-000000000001';
  v_other_formateur_id uuid := '10000000-0000-0000-0000-000000000002';
  v_source_id uuid;
  v_source_other_id uuid;
  v_transcription_id uuid;
  v_transcription_other_id uuid;
  v_seg1_id uuid;
  v_seg2_id uuid;
  v_foreign_seg_id uuid;
  v_chunk_id uuid;
  v_published_family_id uuid;
  v_draft_family_id uuid;
  v_epreuve_id uuid;
  v_sous_section_id uuid;
  v_point_id uuid;
  v_exercise_id uuid;
  v_source_status text;
  v_source_review text;
  v_family_status text;
  v_result jsonb;
  v_reviewed_by uuid;
  v_reviewed_text text;
  v_transcription_status text;
  v_metadata jsonb;
  v_exercise_contenu jsonb;
  v_exercise_still_exists boolean;
BEGIN
  INSERT INTO auth.users (id, email) VALUES
    (v_formateur_id, 'audio-formateur@test.local'),
    (v_other_formateur_id, 'other-formateur@test.local')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.profiles (id, email, nom, prenom) VALUES
    (v_formateur_id, 'audio-formateur@test.local', 'Formateur', 'Audio'),
    (v_other_formateur_id, 'other-formateur@test.local', 'Autre', 'Formateur')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES
    (v_formateur_id, 'formateur'),
    (v_other_formateur_id, 'formateur')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.epreuves (competence, nom, ordre)
  VALUES ('CO', 'Compréhension orale test', 1)
  ON CONFLICT (competence) DO UPDATE SET nom = excluded.nom
  RETURNING id INTO v_epreuve_id;

  INSERT INTO public.sous_sections (epreuve_id, nom, ordre)
  VALUES (v_epreuve_id, 'Sous-section CO test', 1)
  RETURNING id INTO v_sous_section_id;

  INSERT INTO public.points_a_maitriser (sous_section_id, nom, ordre, niveau_min, niveau_max)
  VALUES (v_sous_section_id, 'Point CO A2 test', 1, 'A1', 'B1')
  RETURNING id INTO v_point_id;

  INSERT INTO public.exercices (
    formateur_id, point_a_maitriser_id, competence, titre, consigne, difficulte, format, contenu
  )
  VALUES (
    v_formateur_id,
    v_point_id,
    'CO',
    'Exercice publié test',
    'Consigne test',
    3,
    'qcm',
    jsonb_build_object(
      'script_audio', 'Script audio de test pour CO.',
      'items', jsonb_build_array(jsonb_build_object('id', 'q1', 'type', 'qcm')),
      'metadata', jsonb_build_object('differentiation_family_id', 'A2CO-PUBLISHED-TEST')
    )
  )
  RETURNING id INTO v_exercise_id;

  INSERT INTO public.pedagogical_sources (
    title, source_kind, pedagogical_domains, themes, status, review_status,
    storage_path, created_by, content_hash, metadata
  )
  VALUES (
    'Source audio test', 'audio', ARRAY['CO']::text[], ARRAY['administratif']::text[], 'analyzed', 'valide',
    'tests/audio/source.mp3', v_formateur_id,
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    '{}'::jsonb
  )
  RETURNING id INTO v_source_id;

  INSERT INTO public.pedagogical_sources (
    title, source_kind, pedagogical_domains, themes, status, review_status,
    storage_path, created_by, content_hash, metadata
  )
  VALUES (
    'Source audio autre formateur', 'audio', ARRAY['CO']::text[], ARRAY['administratif']::text[], 'analyzed', 'valide',
    'tests/audio/other.mp3', v_other_formateur_id,
    'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '{}'::jsonb
  )
  RETURNING id INTO v_source_other_id;

  INSERT INTO public.pedagogical_source_transcriptions (
    source_id, attempt_number, is_current, status, raw_text
  )
  VALUES (
    v_source_id, 1, true, 'ready', 'Texte brut'
  )
  RETURNING id INTO v_transcription_id;

  INSERT INTO public.pedagogical_source_transcriptions (
    source_id, attempt_number, is_current, status, raw_text
  )
  VALUES (
    v_source_other_id, 1, true, 'ready', 'Texte autre'
  )
  RETURNING id INTO v_transcription_other_id;

  INSERT INTO public.pedagogical_source_transcription_segments (
    transcription_id, segment_key, sequence_index, start_ms, end_ms, raw_text, reviewed_text
  )
  VALUES
    (v_transcription_id, 'seg-1', 0, 0, 1000, 'Bonjour', NULL),
    (v_transcription_id, 'seg-2', 1, 1000, 2000, 'Au revoir', NULL)
  RETURNING id INTO v_seg2_id;

  SELECT id INTO v_seg1_id
  FROM public.pedagogical_source_transcription_segments
  WHERE transcription_id = v_transcription_id AND segment_key = 'seg-1';

  SELECT id INTO v_seg2_id
  FROM public.pedagogical_source_transcription_segments
  WHERE transcription_id = v_transcription_id AND segment_key = 'seg-2';

  INSERT INTO public.pedagogical_source_transcription_segments (
    transcription_id, segment_key, sequence_index, start_ms, end_ms, raw_text, reviewed_text
  )
  VALUES (
    v_transcription_other_id, 'foreign-seg', 0, 0, 500, 'Étranger', NULL
  )
  RETURNING id INTO v_foreign_seg_id;

  INSERT INTO public.pedagogical_source_chunks (
    source_id, chunk_type, title, content_text, domains, metadata
  )
  VALUES (
    v_source_id, 'resume', 'Chunk test', 'Contenu chunk', ARRAY['CO']::text[], '{}'::jsonb
  )
  RETURNING id INTO v_chunk_id;

  INSERT INTO public.pedagogical_source_chunk_segments (chunk_id, segment_id, sequence_index)
  SELECT v_chunk_id, id, sequence_index
  FROM public.pedagogical_source_transcription_segments
  WHERE transcription_id = v_transcription_id;

  INSERT INTO public.differentiation_families (
    source_id, family_id, competence, schema_version, referential_version, source_content_hash,
    generation_status, validation_status, review_status, payload, created_by,
    generation_started_at, generation_completed_at, published_exercise_id
  )
  VALUES (
    v_source_id, 'A2CO-PUBLISHED-TEST', 'CO', 'slice-1.0', '1.0',
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'generated', 'passed', 'published', '{}'::jsonb, v_formateur_id,
    now(), now(), v_exercise_id
  )
  RETURNING id INTO v_published_family_id;

  INSERT INTO public.differentiation_families (
    source_id, family_id, competence, schema_version, referential_version, source_content_hash,
    generation_status, validation_status, review_status, payload, created_by,
    generation_started_at, generation_completed_at
  )
  VALUES (
    v_source_id, 'A2CO-DRAFT-TEST', 'CO', 'slice-1.0', '1.0',
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'generated', 'passed', 'validated', '{}'::jsonb, v_formateur_id,
    now(), now()
  )
  RETURNING id INTO v_draft_family_id;

  -- ─── SOURCE_FORBIDDEN ───────────────────────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_other_formateur_id)::text, true);
  BEGIN
    PERFORM public.validate_pedagogical_source_transcription_review(
      v_transcription_id,
      'Texte relu',
      jsonb_build_array(
        jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour relu'),
        jsonb_build_object('id', v_seg2_id, 'reviewed_text', 'Au revoir relu')
      )
    );
    RAISE EXCEPTION 'SOURCE_FORBIDDEN not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%SOURCE_FORBIDDEN%' THEN
        RAISE;
      END IF;
  END;
  EXECUTE 'RESET ROLE';

  -- ─── Rollback transactionnel (interruption volontaire) ──────────────────────
  CREATE OR REPLACE FUNCTION public.test_abort_transcription_review_after_segment_update()
  RETURNS trigger
  LANGUAGE plpgsql
  AS $trigger$
  BEGIN
    RAISE EXCEPTION 'TEST_ABORT_AFTER_SEGMENT_UPDATE';
  END;
  $trigger$;

  CREATE TRIGGER trg_test_abort_transcription_review
    BEFORE UPDATE ON public.pedagogical_sources
    FOR EACH ROW
    EXECUTE FUNCTION public.test_abort_transcription_review_after_segment_update();

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_formateur_id)::text, true);

  BEGIN
    PERFORM public.validate_pedagogical_source_transcription_review(
      v_transcription_id,
      'Texte relu complet',
      jsonb_build_array(
        jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour relu'),
        jsonb_build_object('id', v_seg2_id, 'reviewed_text', 'Au revoir relu')
      )
    );
    RAISE EXCEPTION 'TEST_ABORT_AFTER_SEGMENT_UPDATE not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%TEST_ABORT_AFTER_SEGMENT_UPDATE%' THEN
        RAISE;
      END IF;
  END;

  EXECUTE 'RESET ROLE';

  DROP TRIGGER trg_test_abort_transcription_review ON public.pedagogical_sources;
  DROP FUNCTION public.test_abort_transcription_review_after_segment_update();

  IF EXISTS (
    SELECT 1
    FROM public.pedagogical_source_transcription_segments
    WHERE transcription_id = v_transcription_id
      AND reviewed_text IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Segment rollback failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pedagogical_source_transcriptions
    WHERE id = v_transcription_id
      AND status <> 'ready'
  ) THEN
    RAISE EXCEPTION 'Transcription rollback failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.pedagogical_source_chunks
    WHERE id = v_chunk_id
  ) THEN
    RAISE EXCEPTION 'Chunk rollback failed';
  END IF;

  SELECT status, review_status
  INTO v_source_status, v_source_review
  FROM public.pedagogical_sources
  WHERE id = v_source_id;

  IF v_source_status <> 'analyzed' OR v_source_review <> 'valide' THEN
    RAISE EXCEPTION 'Source rollback failed';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.differentiation_families
    WHERE id = v_published_family_id
      AND review_status <> 'published'
  ) THEN
    RAISE EXCEPTION 'Published family rollback failed';
  END IF;

  -- ─── Validations négatives des segments ─────────────────────────────────────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_formateur_id)::text, true);

  BEGIN
    PERFORM public.validate_pedagogical_source_transcription_review(
      v_transcription_id,
      'Texte relu complet',
      jsonb_build_array(
        jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour relu')
      )
    );
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_INCOMPLETE not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%TRANSCRIPTION_SEGMENTS_INCOMPLETE%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.validate_pedagogical_source_transcription_review(
      v_transcription_id,
      'Texte relu complet',
      jsonb_build_array(
        jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour relu'),
        jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour dup')
      )
    );
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_DUPLICATED not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%TRANSCRIPTION_SEGMENTS_DUPLICATED%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.validate_pedagogical_source_transcription_review(
      v_transcription_id,
      'Texte relu complet',
      jsonb_build_array(
        jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour relu'),
        jsonb_build_object('id', v_foreign_seg_id, 'reviewed_text', 'Étranger relu')
      )
    );
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_MISMATCH not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%TRANSCRIPTION_SEGMENTS_MISMATCH%'
         AND SQLERRM NOT LIKE '%TRANSCRIPTION_SEGMENTS_INCOMPLETE%' THEN
        RAISE;
      END IF;
  END;

  BEGIN
    PERFORM public.validate_pedagogical_source_transcription_review(
      v_transcription_id,
      'Texte relu complet',
      jsonb_build_array(
        jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour relu'),
        jsonb_build_object('id', v_seg2_id, 'reviewed_text', '   ')
      )
    );
    RAISE EXCEPTION 'TRANSCRIPTION_SEGMENTS_INVALID not raised';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM NOT LIKE '%TRANSCRIPTION_SEGMENTS_INVALID%' THEN
        RAISE;
      END IF;
  END;

  -- ─── Parcours réussi ────────────────────────────────────────────────────────
  v_result := public.validate_pedagogical_source_transcription_review(
    v_transcription_id,
    'Bonjour relu. Au revoir relu.',
    jsonb_build_array(
      jsonb_build_object('id', v_seg1_id, 'reviewed_text', 'Bonjour relu'),
      jsonb_build_object('id', v_seg2_id, 'reviewed_text', 'Au revoir relu')
    )
  );

  IF coalesce(v_result->>'ok', 'false') <> 'true' THEN
    RAISE EXCEPTION 'Success path did not return ok=true: %', v_result;
  END IF;

  IF (v_result->>'published_family_count')::integer <> 1 THEN
    RAISE EXCEPTION 'published_family_count expected 1, got %', v_result->>'published_family_count';
  END IF;

  SELECT status, reviewed_by, reviewed_text
  INTO v_transcription_status, v_reviewed_by, v_reviewed_text
  FROM public.pedagogical_source_transcriptions
  WHERE id = v_transcription_id;

  IF v_transcription_status <> 'reviewed' THEN
    RAISE EXCEPTION 'Transcription status expected reviewed, got %', v_transcription_status;
  END IF;

  IF v_reviewed_by IS DISTINCT FROM v_formateur_id THEN
    RAISE EXCEPTION 'reviewed_by mismatch';
  END IF;

  IF v_reviewed_text IS DISTINCT FROM 'Bonjour relu. Au revoir relu.' THEN
    RAISE EXCEPTION 'reviewed_text mismatch: %', v_reviewed_text;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pedagogical_source_transcription_segments
    WHERE transcription_id = v_transcription_id
      AND (
        (segment_key = 'seg-1' AND reviewed_text IS DISTINCT FROM 'Bonjour relu')
        OR (segment_key = 'seg-2' AND reviewed_text IS DISTINCT FROM 'Au revoir relu')
      )
  ) THEN
    RAISE EXCEPTION 'Segment reviewed_text mismatch';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.pedagogical_source_chunks WHERE source_id = v_source_id
  ) THEN
    RAISE EXCEPTION 'Chunks were not deleted';
  END IF;

  SELECT status, review_status, metadata
  INTO v_source_status, v_source_review, v_metadata
  FROM public.pedagogical_sources
  WHERE id = v_source_id;

  IF v_source_status <> 'imported' THEN
    RAISE EXCEPTION 'Source status expected imported, got %', v_source_status;
  END IF;

  IF v_source_review <> 'a_remplacer' THEN
    RAISE EXCEPTION 'Source review_status expected a_remplacer, got %', v_source_review;
  END IF;

  IF coalesce((v_metadata->>'transcription_review_requires_reanalysis')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'transcription_review_requires_reanalysis missing';
  END IF;

  IF coalesce((v_metadata->>'published_source_stale')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'published_source_stale missing';
  END IF;

  IF v_metadata->>'published_source_stale_at' IS NULL THEN
    RAISE EXCEPTION 'published_source_stale_at missing';
  END IF;

  SELECT review_status INTO v_family_status
  FROM public.differentiation_families
  WHERE id = v_draft_family_id;

  IF v_family_status <> 'archived' THEN
    RAISE EXCEPTION 'Non-published family expected archived, got %', v_family_status;
  END IF;

  SELECT review_status INTO v_family_status
  FROM public.differentiation_families
  WHERE id = v_published_family_id;

  IF v_family_status <> 'published' THEN
    RAISE EXCEPTION 'Published family must remain published, got %', v_family_status;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.exercices WHERE id = v_exercise_id)
  INTO v_exercise_still_exists;

  IF NOT v_exercise_still_exists THEN
    RAISE EXCEPTION 'Published exercise was deleted unexpectedly';
  END IF;

  SELECT contenu INTO v_exercise_contenu
  FROM public.exercices
  WHERE id = v_exercise_id;

  IF coalesce((v_exercise_contenu->'metadata'->>'source_stale')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Exercise source_stale metadata missing: %', v_exercise_contenu;
  END IF;

  IF v_exercise_contenu->'metadata'->>'source_stale_at' IS NULL THEN
    RAISE EXCEPTION 'Exercise source_stale_at metadata missing';
  END IF;

  EXECUTE 'RESET ROLE';

  RAISE NOTICE 'a2_audio_review_fixes_test: OK';
END;
$$;

ROLLBACK;
