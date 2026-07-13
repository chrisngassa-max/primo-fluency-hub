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
  v_technical_account_id uuid := '00000000-0000-0000-0000-000000000105';
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
  INSERT INTO auth.users (id, email) VALUES (v_technical_account_id, 'technical.s01@test.com');

  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_formateur_id, 'Rossi', 'Mme');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_stranger_formateur_id, 'Etranger', 'M.');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_student_id, 'Diallo', 'Awa');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_other_student_id, 'Benali', 'Yasmine');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_technical_account_id, 'Generateur', 'Compte technique');

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
  -- Création de l'exercice en service_role (un INSERT apprenant sur
  -- `exercices` échouerait de toute façon par RLS — ce n'est pas ce que ce
  -- test vérifie ; on isole ici strictement la falsification d'attempt).
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
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

  -- ── Test 7 : release_corrections fonctionne via le PARCOURS INTÉGRÉ
  -- (session_document_links), sans aucune ligne session_exercices, pour un
  -- formateur qui n'est PAS exercices.formateur_id (2e relecture, point 2) ──
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, metadata_code, titre, consigne, competence, format, niveau_vise, difficulte, contenu, pedagogical_status)
    VALUES (v_technical_account_id, v_point_id, 'test:s01:security:integre', 'Exercice intégré', 'Consigne', 'CE', 'qcm', 'A2', 3,
      '{"items":[{"question":"Q","options":["A","B"],"bonne_reponse":"A"}]}'::jsonb, 'published')
    RETURNING id INTO v_exercice_id;
  -- formateur_id volontairement un compte TECHNIQUE distinct (ex. compte
  -- générateur) — le formateur réel de la séance (v_formateur_id) n'est PAS
  -- exercices.formateur_id ici, exactement le cas signalé par la relecture.
  INSERT INTO public.session_document_links (session_code, linked_type, linked_id, audience, display_order)
    VALUES ('S01', 'exercise', v_exercice_id, 'both', 1);
  INSERT INTO public.exercise_attempts (exercise_id, learner_id, status, score_normalized, item_results)
    VALUES (v_exercice_id, v_student_id, 'completed', 90, '{"0":{"correct":true}}'::jsonb);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_formateur_id)::text, true);
  PERFORM public.release_corrections(v_exercice_id, NULL, 'finished');

  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  IF (SELECT correction_released_at FROM public.exercise_attempts WHERE exercise_id = v_exercice_id AND learner_id = v_student_id) IS NULL THEN
    RAISE EXCEPTION 'TEST 7 ÉCHOUÉ : le formateur du groupe n''a pas pu libérer via le parcours intégré (session_document_links) alors qu''il n''est pas exercices.formateur_id';
  END IF;
  RAISE NOTICE 'TEST 7 OK : libération via session_document_links réussie pour le formateur du groupe, sans dépendre de exercices.formateur_id';

  -- ── Test 8 : scopes subgroup et level réellement insérables et fonctionnels ──
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  INSERT INTO public.group_members (group_id, eleve_id) VALUES (v_group_id, v_other_student_id);
  INSERT INTO public.exercise_attempts (exercise_id, learner_id, status, score_normalized, item_results)
    VALUES (v_exercice_id, v_other_student_id, 'completed', 70, '{"0":{"correct":true}}'::jsonb);

  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_formateur_id)::text, true);
  PERFORM public.release_corrections(v_exercice_id, ARRAY[v_other_student_id], 'subgroup');
  PERFORM public.release_corrections(v_exercice_id, ARRAY[v_other_student_id], 'level');

  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  IF EXISTS (SELECT 1 FROM public.correction_release_events WHERE exercise_id = v_exercice_id AND scope = 'subgroup') = false THEN
    RAISE EXCEPTION 'TEST 8a ÉCHOUÉ : le scope subgroup n''a pas pu être inséré (CHECK constraint trop restrictif ?)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.correction_release_events WHERE exercise_id = v_exercice_id AND scope = 'level') = false THEN
    RAISE EXCEPTION 'TEST 8b ÉCHOUÉ : le scope level n''a pas pu être inséré (CHECK constraint trop restrictif ?)';
  END IF;
  RAISE NOTICE 'TEST 8 OK : scopes subgroup et level acceptés par correction_release_events.scope et par release_corrections()';

  -- ── Test 9 : saut civique INTERMÉDIAIRE bloqué (draft->trainer_approved),
  -- pas seulement les transitions vers publishable/published (2e relecture,
  -- point 8) ──
  EXECUTE 'SET LOCAL ROLE service_role';
  RESET request.jwt.claims;
  v_raised := false;
  BEGIN
    UPDATE public.exercices SET pedagogical_status = 'trainer_approved' WHERE id = v_civic_exercice_id;
  EXCEPTION WHEN OTHERS THEN
    v_raised := true;
    RAISE NOTICE 'TEST 9 OK (attendu) : %', SQLERRM;
  END;
  IF NOT v_raised THEN
    RAISE EXCEPTION 'TEST 9 ÉCHOUÉ : un exercice civique a sauté de draft à trainer_approved (palier intermédiaire, jamais vérifié par la 1ère version du trigger)';
  END IF;

  RAISE NOTICE '=== TOUS LES TESTS SQL S01_SECURITY_FIXES ONT PASSÉ (à confirmer par exécution réelle) ===';
END $$;

ROLLBACK;

-- =====================================================================================
-- TEST 10 (transaction séparée, NON annulée volontairement en fin de bloc) :
-- déduplication de session_document_links avec un doublon PRÉEXISTANT
-- (2e relecture, point 9). Simule l'état "avant migration" en désactivant
-- temporairement les index uniques, insère un doublon volontaire, puis
-- rejoue exactement l'algorithme de déduplication de la migration
-- 20260713090000 pour vérifier qu'il ne perd aucune ligne au-delà du
-- doublon et se termine sans erreur.
-- =====================================================================================
BEGIN;

DO $$
DECLARE
  v_exercice_id uuid;
  v_point_id uuid;
  v_formateur_id uuid := '00000000-0000-0000-0000-000000000201';
  v_kept_id uuid;
  v_removed_count integer := 0;
  v_final_count integer;
BEGIN
  EXECUTE 'SET LOCAL ROLE service_role';
  INSERT INTO auth.users (id, email) VALUES (v_formateur_id, 'formateur.dedup@test.com');
  INSERT INTO public.profiles (id, nom, prenom) VALUES (v_formateur_id, 'Test', 'Dedup');
  SELECT id INTO v_point_id FROM public.points_a_maitriser LIMIT 1;

  INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, metadata_code, titre, consigne, competence, format, niveau_vise, difficulte, contenu)
    VALUES (v_formateur_id, v_point_id, 'test:s01:security:dedup', 'Exercice dedup', 'Consigne', 'CE', 'qcm', 'A2', 3, '{"items":[{"question":"Q","options":["A","B"],"bonne_reponse":"A"}]}'::jsonb)
    RETURNING id INTO v_exercice_id;

  -- Les index uniques existent déjà (migration déjà appliquée) : on les
  -- retire temporairement pour pouvoir simuler l'état "doublon préexistant"
  -- qui aurait précédé leur création — exactement le scénario que la
  -- migration doit gérer la première fois qu'elle s'exécute sur une base
  -- ayant déjà accumulé des doublons via l'ancien code (avant Fix 5).
  DROP INDEX IF EXISTS session_document_links_common_unique;
  DROP INDEX IF EXISTS session_document_links_individual_unique;

  INSERT INTO public.session_document_links (session_code, linked_type, linked_id, audience, display_order)
    VALUES ('S01', 'exercise', v_exercice_id, 'both', 1);
  INSERT INTO public.session_document_links (session_code, linked_type, linked_id, audience, display_order, updated_at)
    VALUES ('S01', 'exercise', v_exercice_id, 'both', 2, now() + interval '1 hour')
    RETURNING id INTO v_kept_id; -- le plus récent : doit être conservé

  -- Rejoue l'algorithme de déduplication de la migration (section 7).
  DECLARE
    v_removed_id uuid;
  BEGIN
    FOR v_removed_id IN
      SELECT id FROM (
        SELECT id, row_number() OVER (PARTITION BY session_code, linked_id ORDER BY updated_at DESC, id DESC) AS rn
        FROM public.session_document_links
        WHERE eleve_id IS NULL AND linked_id = v_exercice_id
      ) ranked
      WHERE rn > 1
    LOOP
      DELETE FROM public.session_document_links WHERE id = v_removed_id;
      v_removed_count := v_removed_count + 1;
    END LOOP;
  END;

  SELECT count(*) INTO v_final_count FROM public.session_document_links WHERE linked_id = v_exercice_id;

  IF v_removed_count <> 1 THEN
    RAISE EXCEPTION 'TEST 10 ÉCHOUÉ : attendu exactement 1 ligne supprimée, obtenu %', v_removed_count;
  END IF;
  IF v_final_count <> 1 THEN
    RAISE EXCEPTION 'TEST 10 ÉCHOUÉ : attendu exactement 1 ligne restante après déduplication, obtenu %', v_final_count;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.session_document_links WHERE id = v_kept_id) THEN
    RAISE EXCEPTION 'TEST 10 ÉCHOUÉ : la ligne conservée n''est pas la plus récente (perte d''information)';
  END IF;

  -- Recrée les index (comme le ferait la fin de la migration) pour prouver
  -- qu'ils s'appliquent maintenant sans erreur sur des données dédupliquées.
  CREATE UNIQUE INDEX session_document_links_common_unique
    ON public.session_document_links (session_code, linked_id) WHERE eleve_id IS NULL;
  CREATE UNIQUE INDEX session_document_links_individual_unique
    ON public.session_document_links (session_code, linked_id, eleve_id) WHERE eleve_id IS NOT NULL;

  RAISE NOTICE 'TEST 10 OK : doublon préexistant dédupliqué sans perte (ligne la plus récente conservée), index uniques recréés sans erreur';
END $$;

ROLLBACK;
