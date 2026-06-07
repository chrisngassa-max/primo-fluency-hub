-- =====================================================================================
-- SUITE DE TESTS SQL (LOT 0) — AUTOMATISATION ET SÉCURITÉ DES SÉANCES
-- À exécuter dans une transaction annulée pour valider le comportement en toute sécurité.
-- =====================================================================================

BEGIN;

-- 1. APPLIQUER LA MIGRATION COMPLÈTE TEMPORAIREMENT POUR LE TEST
\i supabase/migrations/20260606020000_session_automation.sql

-- 2. CRÉATION DES TABLES TEMPORAIRES POUR ENREGISTRER LES RÉSULTATS

CREATE TEMP TABLE test_ids (
  key text PRIMARY KEY,
  id uuid
);

CREATE TEMP TABLE test_results (
  step_num integer PRIMARY KEY,
  test_name text NOT NULL,
  session_exercices_visibles integer,
  exercices_visibles integer,
  result_status text NOT NULL,
  details text
);


-- 3. INITIALISATION ET EXÉCUTION DES TESTS PEDAGOGIQUES & DE CONCURRENCE
DO $$
DECLARE
  v_formateur_id uuid := '00000000-0000-0000-0000-000000000001';
  v_other_formateur_id uuid := '00000000-0000-0000-0000-000000000005';
  v_student_1_id uuid := '00000000-0000-0000-0000-000000000002';
  v_student_2_id uuid := '00000000-0000-0000-0000-000000000003';
  v_stranger_id  uuid := '00000000-0000-0000-0000-000000000004';
  
  v_group_id uuid;
  v_session_id uuid;
  v_epreuve_id uuid;
  v_sous_section_id uuid;
  v_point_id uuid;
  
  v_exercice_owner_id uuid;
  v_exercice_other_id uuid;
  v_exercice_live_id uuid;
  
  v_claimed boolean;
  v_assigned_count integer;
  v_event_count integer;
  v_se_count integer;
  v_ex_count integer;
BEGIN
  -- Insérer les utilisateurs auth
  INSERT INTO auth.users (id, email) VALUES (v_formateur_id, 'formateur@test.com');
  INSERT INTO auth.users (id, email) VALUES (v_other_formateur_id, 'other_formateur@test.com');
  INSERT INTO auth.users (id, email) VALUES (v_student_1_id, 'student1@test.com');
  INSERT INTO auth.users (id, email) VALUES (v_student_2_id, 'student2@test.com');
  INSERT INTO auth.users (id, email) VALUES (v_stranger_id, 'stranger@test.com');
  
  -- Rôles utilisateurs
  INSERT INTO public.user_roles (user_id, role) VALUES (v_formateur_id, 'formateur');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_other_formateur_id, 'formateur');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_student_1_id, 'eleve');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_student_2_id, 'eleve');
  INSERT INTO public.user_roles (user_id, role) VALUES (v_stranger_id, 'eleve');
  
  -- Créer le groupe
  INSERT INTO public.groups (nom, formateur_id, niveau)
  VALUES ('Groupe Alpha', v_formateur_id, 'A2')
  RETURNING id INTO v_group_id;
  
  -- Ajouter les membres au groupe
  INSERT INTO public.group_members (group_id, eleve_id) VALUES (v_group_id, v_student_1_id);
  INSERT INTO public.group_members (group_id, eleve_id) VALUES (v_group_id, v_student_2_id);
  
  -- Structure minimale
  SELECT id INTO v_epreuve_id FROM public.epreuves WHERE competence = 'CE' LIMIT 1;
  IF v_epreuve_id IS NULL THEN
    INSERT INTO public.epreuves (competence, nom, ordre)
    VALUES ('CE', 'Compréhension Écrite', 1)
    RETURNING id INTO v_epreuve_id;
  END IF;
  
  SELECT id INTO v_sous_section_id FROM public.sous_sections WHERE epreuve_id = v_epreuve_id LIMIT 1;
  IF v_sous_section_id IS NULL THEN
    INSERT INTO public.sous_sections (epreuve_id, nom, ordre)
    VALUES (v_epreuve_id, 'Sous-section CE', 1)
    RETURNING id INTO v_sous_section_id;
  END IF;
  
  SELECT id INTO v_point_id FROM public.points_a_maitriser WHERE sous_section_id = v_sous_section_id LIMIT 1;
  IF v_point_id IS NULL THEN
    INSERT INTO public.points_a_maitriser (sous_section_id, nom, ordre)
    VALUES (v_sous_section_id, 'Point CE', 1)
    RETURNING id INTO v_point_id;
  END IF;
  
  -- Exercices
  INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, competence, titre, consigne, difficulte)
  VALUES (v_formateur_id, v_point_id, 'CE', 'Ex Propriétaire', 'Consigne CE', 3)
  RETURNING id INTO v_exercice_owner_id;

  INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, competence, titre, consigne, difficulte)
  VALUES (v_other_formateur_id, v_point_id, 'CE', 'Ex Autre Formateur', 'Consigne CE', 3)
  RETURNING id INTO v_exercice_other_id;

  -- Créer la séance
  INSERT INTO public.sessions (
    group_id, titre, date_seance, niveau_cible,
    nb_exercices_souhaite, nb_exercices_retrospective, duree_retrospective,
    nb_questions_diagnostic, difficulte_par_defaut
  ) VALUES (
    v_group_id, 'Séance 1', now(), 'A2',
    5, 3, 10, 10, 5
  ) RETURNING id INTO v_session_id;

  -- Associations
  INSERT INTO public.session_exercices (session_id, exercice_id, eleve_id, statut, bloc)
  VALUES (v_session_id, v_exercice_owner_id, NULL, 'planifie', 'core');

  INSERT INTO public.session_exercices (session_id, exercice_id, eleve_id, statut, bloc)
  VALUES (v_session_id, v_exercice_owner_id, v_student_1_id, 'planifie', 'core');

  INSERT INTO public.session_exercices (session_id, exercice_id, eleve_id, statut, bloc)
  VALUES (v_session_id, v_exercice_owner_id, v_student_2_id, 'planifie', 'core');

  -- Enregistrer IDs
  INSERT INTO test_ids VALUES ('session', v_session_id);
  INSERT INTO test_ids VALUES ('exercice_owner', v_exercice_owner_id);
  INSERT INTO test_ids VALUES ('exercice_other', v_exercice_other_id);

  INSERT INTO test_results VALUES (1, 'Initialisation données de test', 3, 2, 'PASSED', 'Tables de tests alimentées.');


  -- =====================================================================================
  -- RPC ASSIGN_LIVE_SESSION_EXERCISES
  -- =====================================================================================

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_formateur_id)::text, true);

  -- 2.1 Exercice tiers (doit échouer)
  BEGIN
    PERFORM public.assign_live_session_exercises(v_session_id, ARRAY[v_exercice_other_id], ARRAY[v_student_1_id]);
    INSERT INTO test_results VALUES (2, 'RPC: Vérification de propriété (exercice tiers)', 0, 0, 'FAILED', 'Erreur : attribution autorisée pour un exercice tiers.');
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM LIKE '%does not belong to the session trainer%' THEN
      INSERT INTO test_results VALUES (2, 'RPC: Vérification de propriété (exercice tiers)', 0, 0, 'PASSED', 'Rejet correct d''un exercice appartenant à un autre formateur.');
    ELSE
      INSERT INTO test_results VALUES (2, 'RPC: Vérification de propriété (exercice tiers)', 0, 0, 'FAILED', 'Erreur inattendue : ' || SQLERRM);
    END IF;
  END;

  -- 2.2 Attribution normale (succès)
  BEGIN
    INSERT INTO public.exercices (formateur_id, point_a_maitriser_id, competence, titre, consigne, difficulte)
    VALUES (v_formateur_id, v_point_id, 'CE', 'Ex Live', 'Consigne Live', 3)
    RETURNING id INTO v_exercice_live_id;

    INSERT INTO test_ids VALUES ('exercice_live', v_exercice_live_id);

    v_assigned_count := public.assign_live_session_exercises(v_session_id, ARRAY[v_exercice_live_id], ARRAY[v_student_1_id]);
    
    SELECT count(*) INTO v_event_count FROM public.session_live_events
    WHERE session_id = v_session_id AND eleve_id = v_student_1_id AND event_type = 'intervention_recue';

    IF v_assigned_count = 1 AND v_event_count = 1 THEN
      INSERT INTO test_results VALUES (3, 'RPC: Attribution normale (insertion effective)', 1, 1, 'PASSED', 'Attribution initiale réussie (1 insertion, 1 événement créé).');
    ELSE
      INSERT INTO test_results VALUES (3, 'RPC: Attribution normale (insertion effective)', v_assigned_count, v_event_count, 'FAILED', 'Erreur attribution initiale ou événement live manquant.');
    END IF;
  END;

  -- 2.3 Idempotence (double appel)
  BEGIN
    v_assigned_count := public.assign_live_session_exercises(v_session_id, ARRAY[v_exercice_live_id], ARRAY[v_student_1_id]);
    
    SELECT count(*) INTO v_event_count FROM public.session_live_events
    WHERE session_id = v_session_id AND eleve_id = v_student_1_id AND event_type = 'intervention_recue';

    IF v_assigned_count = 0 AND v_event_count = 1 THEN
      INSERT INTO test_results VALUES (4, 'RPC: Idempotence (attribution répétée)', 0, 1, 'PASSED', 'Idempotence validée (0 insertion, 0 nouvel événement).');
    ELSE
      INSERT INTO test_results VALUES (4, 'RPC: Idempotence (attribution répétée)', v_assigned_count, v_event_count, 'FAILED', 'Erreur : un doublon a été inséré ou un événement live a été dupliqué.');
    END IF;
  END;


  -- =====================================================================================
  -- RLS SCENARIOS
  -- =====================================================================================

  -- 4.1 ÉLÈVE 1 (membre groupe, cible)
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_student_1_id)::text, true);
  
  SELECT count(*)::integer INTO v_se_count FROM public.session_exercices WHERE session_id = v_session_id;
  SELECT count(*)::integer INTO v_ex_count FROM public.exercices WHERE id IN (v_exercice_owner_id, v_exercice_other_id, v_exercice_live_id);
  
  EXECUTE 'RESET ROLE';
  
  IF v_se_count = 3 AND v_ex_count = 2 THEN
    INSERT INTO test_results VALUES (5, 'RLS: Élève 1 (membre groupe + cible)', v_se_count, v_ex_count, 'PASSED', 'Voit 3 assoc (1 coll, 2 indiv) et 2 exercices.');
  ELSE
    INSERT INTO test_results VALUES (5, 'RLS: Élève 1 (membre groupe + cible)', v_se_count, v_ex_count, 'FAILED', 'Erreur RLS : attendu 3 assoc et 2 exercices.');
  END IF;

  -- 4.2 ÉLÈVE 2 (membre groupe, non cible)
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_student_2_id)::text, true);
  
  SELECT count(*)::integer INTO v_se_count FROM public.session_exercices WHERE session_id = v_session_id;
  SELECT count(*)::integer INTO v_ex_count FROM public.exercices WHERE id IN (v_exercice_owner_id, v_exercice_other_id, v_exercice_live_id);
  
  EXECUTE 'RESET ROLE';
  
  IF v_se_count = 2 AND v_ex_count = 1 THEN
    INSERT INTO test_results VALUES (6, 'RLS: Élève 2 (membre groupe, non cible)', v_se_count, v_ex_count, 'PASSED', 'Voit 2 assoc (1 coll, 1 indiv) et 1 exercice.');
  ELSE
    INSERT INTO test_results VALUES (6, 'RLS: Élève 2 (membre groupe, non cible)', v_se_count, v_ex_count, 'FAILED', 'Erreur RLS : attendu 2 assoc et 1 exercice.');
  END IF;

  -- 4.3 ÉLÈVE EXTÉRIEUR (non membre)
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_stranger_id)::text, true);
  
  SELECT count(*)::integer INTO v_se_count FROM public.session_exercices WHERE session_id = v_session_id;
  SELECT count(*)::integer INTO v_ex_count FROM public.exercices WHERE id IN (v_exercice_owner_id, v_exercice_other_id, v_exercice_live_id);
  
  EXECUTE 'RESET ROLE';
  
  IF v_se_count = 0 AND v_ex_count = 0 THEN
    INSERT INTO test_results VALUES (7, 'RLS: Élève extérieur (non membre)', v_se_count, v_ex_count, 'PASSED', 'Voit 0 assoc et 0 exercice (isolation totale).');
  ELSE
    INSERT INTO test_results VALUES (7, 'RLS: Élève extérieur (non membre)', v_se_count, v_ex_count, 'FAILED', 'Erreur RLS : fuite de données détectée.');
  END IF;

  -- 4.4 FORMATEUR PROPRIÉTAIRE
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_formateur_id)::text, true);
  
  SELECT count(*)::integer INTO v_se_count FROM public.session_exercices WHERE session_id = v_session_id;
  SELECT count(*)::integer INTO v_ex_count FROM public.exercices WHERE id IN (v_exercice_owner_id, v_exercice_other_id, v_exercice_live_id);
  
  EXECUTE 'RESET ROLE';
  
  IF v_se_count = 4 AND v_ex_count = 2 THEN
    INSERT INTO test_results VALUES (8, 'RLS: Formateur propriétaire', v_se_count, v_ex_count, 'PASSED', 'Voit 4 assoc et 2 exercices (ceux qu''il possède).');
  ELSE
    INSERT INTO test_results VALUES (8, 'RLS: Formateur propriétaire', v_se_count, v_ex_count, 'FAILED', 'Erreur RLS : attendu 4 assoc et 2 exercices.');
  END IF;

  -- 4.5 AUTRE FORMATEUR
  EXECUTE 'SET LOCAL ROLE authenticated';
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_other_formateur_id)::text, true);
  
  SELECT count(*)::integer INTO v_se_count FROM public.session_exercices WHERE session_id = v_session_id;
  SELECT count(*)::integer INTO v_ex_count FROM public.exercices WHERE id IN (v_exercice_owner_id, v_exercice_other_id, v_exercice_live_id);
  
  EXECUTE 'RESET ROLE';
  
  IF v_se_count = 0 AND v_ex_count = 1 THEN
    INSERT INTO test_results VALUES (9, 'RLS: Autre formateur', v_se_count, v_ex_count, 'PASSED', 'Voit 0 assoc de séance et 1 exercice (le sien).');
  ELSE
    INSERT INTO test_results VALUES (9, 'RLS: Autre formateur', v_se_count, v_ex_count, 'FAILED', 'Erreur RLS : attendu 0 assoc et 1 exercice.');
  END IF;

  -- 4.6 ACCÈS ANONYME
  EXECUTE 'SET LOCAL ROLE anon';
  
  SELECT count(*)::integer INTO v_se_count FROM public.session_exercices WHERE session_id = v_session_id;
  SELECT count(*)::integer INTO v_ex_count FROM public.exercices WHERE id IN (v_exercice_owner_id, v_exercice_other_id, v_exercice_live_id);
  
  EXECUTE 'RESET ROLE';
  
  IF v_se_count = 0 AND v_ex_count = 0 THEN
    INSERT INTO test_results VALUES (10, 'RLS: Accès anonyme', v_se_count, v_ex_count, 'PASSED', 'Voit 0 assoc et 0 exercice (anonyme bloqué).');
  ELSE
    INSERT INTO test_results VALUES (10, 'RLS: Accès anonyme', v_se_count, v_ex_count, 'FAILED', 'Erreur RLS : accès anonyme non bloqué.');
  END IF;


  -- =====================================================================================
  -- CONCURRENCY LOCKS
  -- =====================================================================================

  EXECUTE 'SET LOCAL ROLE service_role';

  -- 5.1 Acquisition initiale
  v_claimed := public.claim_session_block(v_session_id, 'diagnostic');
  EXECUTE 'RESET ROLE';
  IF v_claimed THEN
    INSERT INTO test_results VALUES (11, 'Lock: Acquisition initiale', 0, 0, 'PASSED', 'Premier claim réussi (renvoie true).');
  ELSE
    INSERT INTO test_results VALUES (11, 'Lock: Acquisition initiale', 0, 0, 'FAILED', 'Échec du premier claim_session_block.');
  END IF;

  -- 5.2 Collision immédiate
  EXECUTE 'SET LOCAL ROLE service_role';
  v_claimed := public.claim_session_block(v_session_id, 'diagnostic');
  EXECUTE 'RESET ROLE';
  IF NOT v_claimed THEN
    INSERT INTO test_results VALUES (12, 'Lock: Collision immédiate', 0, 0, 'PASSED', 'Deuxième claim bloqué avec succès (renvoie false).');
  ELSE
    INSERT INTO test_results VALUES (12, 'Lock: Collision immédiate', 0, 0, 'FAILED', 'Erreur : double claim simultané autorisé.');
  END IF;

  -- 5.3 Reprise après expiration (> 5 minutes)
  UPDATE public.session_blocks SET updated_at = now() - interval '6 minutes'
  WHERE session_id = v_session_id AND block_type = 'diagnostic';

  EXECUTE 'SET LOCAL ROLE service_role';
  v_claimed := public.claim_session_block(v_session_id, 'diagnostic');
  EXECUTE 'RESET ROLE';
  IF v_claimed THEN
    INSERT INTO test_results VALUES (13, 'Lock: Reprise après expiration', 0, 0, 'PASSED', 'Acquisition après expiration réussie (renvoie true).');
  ELSE
    INSERT INTO test_results VALUES (13, 'Lock: Reprise après expiration', 0, 0, 'FAILED', 'Erreur : claim bloqué après expiration.');
  END IF;

  -- 5.4 Reprise après échec (failed)
  UPDATE public.session_blocks SET status = 'failed', updated_at = now()
  WHERE session_id = v_session_id AND block_type = 'diagnostic';

  EXECUTE 'SET LOCAL ROLE service_role';
  v_claimed := public.claim_session_block(v_session_id, 'diagnostic');
  EXECUTE 'RESET ROLE';
  IF v_claimed THEN
    INSERT INTO test_results VALUES (14, 'Lock: Reprise après échec', 0, 0, 'PASSED', 'Acquisition après échec réussie (renvoie true).');
  ELSE
    INSERT INTO test_results VALUES (14, 'Lock: Reprise après échec', 0, 0, 'FAILED', 'Erreur : claim bloqué après échec.');
  END IF;

END;
$$;


-- 4. AFFICHAGE DES RESULTATS
RESET ROLE;
SELECT 
  step_num AS "N°",
  test_name AS "Nom du Test",
  session_exercices_visibles AS "Assoc. Visibles",
  exercices_visibles AS "Ex. Visibles",
  result_status AS "Résultat",
  details AS "Description"
FROM test_results
ORDER BY step_num;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM test_results WHERE result_status <> 'PASSED') THEN
    RAISE EXCEPTION 'Lot 0 SQL test suite contains failed assertions';
  END IF;
END;
$$;

-- 5. ROLLBACK FIN DE TEST
ROLLBACK;
