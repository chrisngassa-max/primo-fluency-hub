-- =====================================================================================
-- SUITE DE TESTS SQL — CORRECTIFS SÉCURITÉ S01 (relecture indépendante 2026-07-13)
-- Même convention que supabase/tests/session_automation_test.sql (SET LOCAL ROLE +
-- request.jwt.claims pour simuler un utilisateur authentifié, transaction annulée).
--
-- STATUT : PRÊT À EXÉCUTER, NON EXÉCUTÉ DANS CETTE SESSION. Docker Desktop et WSL2
-- ne sont pas disponibles sur cette machine (aucune distribution WSL installée,
-- confirmé par `wsl --list --verbose`) : aucune instance Postgres locale n'a pu être
-- démarrée pour lancer ce fichier. À exécuter via :
--   supabase db reset && psql "$(supabase status -o env | grep DB_URL)" -f supabase/tests/s01_security_fixes_test.sql
-- avant toute application de la migration 20260713090000 en staging/production.
-- =====================================================================================

BEGIN;

DO $$
DECLARE
  v_formateur_id uuid := '00000000-0000-0000-0000-000000000101';
  v_stranger_formateur_id uuid := '00000000-0000-0000-0000-000000000102';
  v_student_id uuid := '00000000-0000-0000-0000-000000000103';
  v_other_student_id uuid := '00000000-0000-0000-0000-000000000104';
  v_group_id uuid;
  v_training_session_id uuid;
  v_session_id uuid;
  v_point_id uuid;
  v_plan_version_id uuid;
  v_exercice_id uuid;
  v_civic_exercice_id uuid;
  v_insufficient_exercice_id uuid;
  v_attempt_id uuid;
  v_doc_id uuid;
  v_link_id uuid;
  v_activity_id uuid;
  v_raised boolean;
BEGIN
  -- ── Fixtures minimales ──────────────────────────────────────────────
  INSERT INTO auth.users (id, email) VALUES (v_formateur_id, 'formateur.s01@test.com');
  INSERT INTO auth.users (id, email) VALUES (v_stranger_formateur_id, 'stranger.s01@test.com');
  INSERT INTO auth.users (id, email) VALUES (v_student_id, 'student.s01@test.com');
  INSERT INTO auth.users (id, email) VALUES (v_other_student_id, 'other.s01@test.com');

  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_formateur_id, 'Rossi', 'Mme');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_stranger_formateur_id, 'Etranger', 'M.');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_student_id, 'Diallo', 'Awa');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_other_student_id, 'Benali', 'Yasmine');

  INSERT INTO public.user_roles (user_id, role) VALUES (v_formateur_id, 'formateur');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_stranger_formateur_id, 'formateur');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_student_id, 'eleve');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_other_student_id, 'eleve');

  INSERT INTO public.groups (formateur_id, nom, niveau) VALUES (v_formateur_id, 'Groupe test S01', 'A2')
    RETURNING id INTO v_group_id;
  INSERT INTO public.group_members (group_id, eleve_id) VALUES (v_group_id, v_student_id);

  SELECT id INTO v_plan_version_id FROM public.curriculum_plan_versions LIMIT 1;
  INSERT INTO public.training_sessions (plan_version_id, code, ordre, palier)
    VALUES (v_plan_version_id, 'S01', 1, 'CSP') RETURNING id INTO v_training_session_id;

  INSERT INTO public.sessions (group_id, titre, date_seance, training_session_id)
    VALUES (v_group_id, 'Séance test S01', now(), v_training_session_id) RETURNING id INTO v_session_id;

  SELECT id INTO v_point_id FROM public.points_a_maitriser LIMIT 1;

  -- ── Test 1 : impossibilité de falsifier le score (INSERT direct) ────
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_student_id)::text, true);

  INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, metadata_code, titre, consigne, competence, format, niveau_vise, difficulte, contenu)
    VALUES (v_formateur_id, v_point_id, 'test:s01:security:1', 'Exercice test', 'Consigne', 'CE', 'qcm', 'A2', 3, '{"items":[{"question":"Q","options":["A","B"],"bonne_reponse":"A"}]}'::jsonb)
    RETURNING id INTO v_exercice_id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_student_id)::text, true);
  INSERT INTO public.exercise_attempts (exercise_id, learner_id, status, score_normalized, item_results)
    VALUES (v_exercice_id, v_student_id, 'completed', 100, '{"0":{"correct":true}}'::jsonb)
    RETURNING id INTO v_attempt_id;

  IF (SELECT status FROM public.exercise_attempts WHERE id = v_attempt_id) = 'completed' THEN
    RAISE EXCEPTION 'TEST 1 ÉCHOUÉ : un apprenant a réussi à insérer une tentative completed avec score falsifié';
  END IF;
  IF (SELECT score_normalized FROM public.exercise_attempts WHERE id = v_attempt_id) IS NOT NULL THEN
    RAISE EXCEPTION 'TEST 1 ÉCHOUÉ : score_normalized non neutralisé sur INSERT apprenant';
  END IF;
  RAISE NOTICE 'TEST 1 OK : falsification de score bloquée (status forcé à in_progress, score neutralisé)';

  -- ── Test 1bis : falsification via UPDATE direct également bloquée ──
  IF EXISTS (
    SELECT 1 FROM public.exercise_attempts WHERE id = v_attempt_id
  ) THEN
    UPDATE public.exercise_attempts SET status = 'completed', score_normalized = 100, correction_released_at = now()
      WHERE id = v_attempt_id;
    IF (SELECT correction_released_at FROM public.exercise_attempts WHERE id = v_attempt_id) IS NOT NULL THEN
      RAISE EXCEPTION 'TEST 1bis ÉCHOUÉ : un apprenant a réussi à s''auto-libérer sa correction via UPDATE';
    END IF;
    RAISE NOTICE 'TEST 1bis OK : auto-libération bloquée par le trigger';
  END IF;

  -- ── Test 2 : impossibilité de lire un PDF (aucune policy SELECT apprenant) ──
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  INSERT INTO public.session_documents (session_code, document_type, title, status, file_url, content_html, audience, pedagogical_status)
    VALUES ('S01', 'corrige_formateur', 'PDF secret', 'valide', 'https://storage/secret.pdf', '<p>public</p>', 'both', 'published')
    RETURNING id INTO v_doc_id;

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_student_id)::text, true);
  PERFORM 1 FROM public.session_documents WHERE id = v_doc_id;
  IF FOUND THEN
    RAISE EXCEPTION 'TEST 2 ÉCHOUÉ : un apprenant peut lire session_documents directement (RLS insuffisante)';
  END IF;
  RAISE NOTICE 'TEST 2 OK : aucune ligne session_documents visible pour un apprenant en accès direct (file_url donc inatteignable)';

  -- ── Test 3 : publication civique directe draft->published bloquée ──
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, metadata_code, titre, consigne, competence, format, niveau_vise, difficulte, contenu, civic_content, civic_fact_ids)
    VALUES (v_formateur_id, v_point_id, 'test:s01:security:civic', 'Civique test', 'Consigne', 'CE', 'qcm', 'A2', 3,
      '{"items":[{"question":"Q","options":["A","B"],"bonne_reponse":"A"}]}'::jsonb, true, ARRAY['test-fact-1'])
    RETURNING id INTO v_civic_exercice_id;

  v_raised := false;
  BEGIN
    UPDATE public.exercices SET pedagogical_status = 'published' WHERE id = v_civic_exercice_id;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    RAISE NOTICE 'TEST 3 OK (attendu) : %', SQLERRM;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'TEST 3 ÉCHOUÉ : un exercice civique est passé de draft à published sans fait vérifié ni saut de palier bloqué';
  END IF;

  -- ── Test 4 : aucun exercice needs_content_review ne peut être publié ──
  INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, metadata_code, titre, consigne, competence, format, niveau_vise, difficulte, contenu, needs_content_review)
    VALUES (v_formateur_id, v_point_id, 'test:s01:security:insufficient', 'Exercice insuffisant', 'Consigne', 'CE', 'qcm', 'A2', 3,
      '{"items":[{"question":"Q","options":["A","B"],"bonne_reponse":"A"}]}'::jsonb, true)
    RETURNING id INTO v_insufficient_exercice_id;

  v_raised := false;
  BEGIN
    UPDATE public.exercices SET pedagogical_status = 'publishable' WHERE id = v_insufficient_exercice_id;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    RAISE NOTICE 'TEST 4 OK (attendu) : %', SQLERRM;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'TEST 4 ÉCHOUÉ : un exercice needs_content_review=true a été publié';
  END IF;

  -- ── Test 5 : libération individuelle/finished/subgroup, autorisation liée au groupe ──
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  UPDATE public.exercices SET pedagogical_status = 'published' WHERE id = v_exercice_id;
  INSERT INTO public.session_exercices (session_id, exercice_id, ordre)
    VALUES (v_session_id, v_exercice_id, 1);
  INSERT INTO public.exercise_attempts (exercise_id, learner_id, status, score_normalized, item_results)
    VALUES (v_exercice_id, v_student_id, 'completed', 80, '{"0":{"correct":true}}'::jsonb);

  -- Un formateur ÉTRANGER au groupe ne doit pas pouvoir libérer.
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_stranger_formateur_id)::text, true);
  v_raised := false;
  BEGIN
    PERFORM public.release_corrections(v_exercice_id, NULL, 'finished');
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'TEST 5a ÉCHOUÉ : un formateur étranger au groupe a pu libérer la correction';
  END IF;
  RAISE NOTICE 'TEST 5a OK : formateur non lié au groupe rejeté';

  -- Le formateur du groupe PEUT libérer (scope finished).
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_formateur_id)::text, true);
  PERFORM public.release_corrections(v_exercice_id, NULL, 'finished');

  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  IF (SELECT correction_released_at FROM public.exercise_attempts WHERE exercise_id = v_exercice_id AND learner_id = v_student_id) IS NULL THEN
    RAISE EXCEPTION 'TEST 5b ÉCHOUÉ : le formateur du groupe n''a pas pu libérer la correction';
  END IF;
  RAISE NOTICE 'TEST 5b OK : libération finished par le formateur du groupe réussie';

  -- ── Test 6 : correction invisible avant libération (relecture serveur) ──
  -- (Couvert fonctionnellement par les edge functions get-attempt-correction /
  -- submit-seance-answer, non exécutables en SQL pur — voir tests Vitest
  -- session-content-sanitizer.test.ts pour la garantie "jamais bonne_reponse".)

  RAISE NOTICE '=== TOUS LES TESTS SQL S01_SECURITY_FIXES ONT PASSÉ (à confirmer par exécution réelle) ===';
END $$;

ROLLBACK;
