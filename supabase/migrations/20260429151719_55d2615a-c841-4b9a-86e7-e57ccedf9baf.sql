-- ============================================================================
-- VAGUE 1 — Durcissement RLS prudent (non destructif)
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────
-- 1) PROFILES — restreindre "pending" aux invités du formateur
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Formateurs view pending students" ON public.profiles;

-- Un formateur ne voit un profil pending que si cet email a une invitation
-- de groupe créée par ce formateur (via group_invitations.created_by).
CREATE POLICY "Formateurs view own invited pending students"
  ON public.profiles
  FOR SELECT
  USING (
    status = 'pending'
    AND has_role(auth.uid(), 'formateur'::app_role)
    AND EXISTS (
      SELECT 1
      FROM public.group_invitations gi
      WHERE gi.created_by = auth.uid()
        AND gi.expires_at > now()
    )
    AND EXISTS (
      -- L'élève pending doit déjà être membre d'un groupe du formateur
      -- OU avoir utilisé une invitation du formateur (used_count > 0).
      SELECT 1 FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.eleve_id = profiles.id AND g.formateur_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 2) STORAGE — bucket exercise-images
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Service role can upload exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can update exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Service role can delete exercise images" ON storage.objects;

-- Lecture publique conservée (les images doivent s'afficher en frontend).
-- Si une policy de SELECT public existe déjà sur ce bucket on n'y touche pas.

CREATE POLICY "Authenticated formateurs can upload exercise images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-images'
    AND (
      has_role(auth.uid(), 'formateur'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR auth.role() = 'service_role'
    )
  );

CREATE POLICY "Authenticated formateurs can update exercise images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND (
      has_role(auth.uid(), 'formateur'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR auth.role() = 'service_role'
    )
  );

CREATE POLICY "Authenticated formateurs can delete exercise images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND (
      has_role(auth.uid(), 'formateur'::app_role)
      OR has_role(auth.uid(), 'admin'::app_role)
      OR auth.role() = 'service_role'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────
-- 3) RESULTATS — retirer UPDATE/DELETE élève (jamais utilisé légitimement)
-- ─────────────────────────────────────────────────────────────────────────
-- Recherche dans le code: aucun supabase.from("resultats").update(...) côté élève.
-- L'élève fait uniquement INSERT (DevoirPassation, BilanSeance, etc.).
-- On split la policy ALL en INSERT + SELECT.

-- L'ancienne policy "Eleves manage own resultats" pourrait exister sous différents noms.
DROP POLICY IF EXISTS "Eleves manage own resultats" ON public.resultats;
DROP POLICY IF EXISTS "Eleves manage resultats" ON public.resultats;

CREATE POLICY "Eleves insert own resultats"
  ON public.resultats FOR INSERT
  WITH CHECK (eleve_id = auth.uid());

CREATE POLICY "Eleves view own resultats"
  ON public.resultats FOR SELECT
  USING (eleve_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 4) BILAN_TEST_RESULTS — retirer UPDATE/DELETE élève
-- ─────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Eleves manage own bilan_test_results" ON public.bilan_test_results;

CREATE POLICY "Eleves insert own bilan_test_results"
  ON public.bilan_test_results FOR INSERT
  WITH CHECK (eleve_id = auth.uid());

CREATE POLICY "Eleves view own bilan_test_results"
  ON public.bilan_test_results FOR SELECT
  USING (eleve_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 5) DIAGNOSTIC_ENTREE — l'élève n'écrit jamais dedans (formateur/edge only)
-- ─────────────────────────────────────────────────────────────────────────
-- Aucune policy à changer : "Eleves view own diagnostics" est déjà SELECT only.
-- (vérifié: pas de policy ALL côté élève sur cette table)

-- ─────────────────────────────────────────────────────────────────────────
-- 6) EXERCISE_ATTEMPTS — restreindre l'UPDATE élève
-- ─────────────────────────────────────────────────────────────────────────
-- L'élève a besoin de UPDATE pour useLiveAttemptSync (answers + item_results
-- en cours). Mais il NE doit PAS pouvoir modifier:
--   score_normalized, score_raw, status (sauf in_progress→in_progress),
--   source_resultat_id, completed_at, feedback_text, assignment_id.
-- → Trigger BEFORE UPDATE qui réécrit ces champs avec OLD.* si l'utilisateur
--   est l'élève (auth.uid() = learner_id) ET pas service_role.

CREATE OR REPLACE FUNCTION public.guard_exercise_attempts_eleve_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Si l'appelant est l'élève propriétaire et pas service_role : on bloque
  -- toute modification des champs sensibles.
  IF auth.role() <> 'service_role'
     AND NEW.learner_id = auth.uid() THEN

    -- Bloquer la transition de in_progress vers completed côté client :
    -- la finalisation est faite par le trigger mirror_resultat_to_attempt.
    IF OLD.status = 'completed' THEN
      RAISE EXCEPTION 'Cannot modify a completed attempt';
    END IF;

    NEW.status := OLD.status;
    NEW.score_normalized := OLD.score_normalized;
    NEW.score_raw := OLD.score_raw;
    NEW.completed_at := OLD.completed_at;
    NEW.source_resultat_id := OLD.source_resultat_id;
    NEW.feedback_text := OLD.feedback_text;
    NEW.assignment_id := OLD.assignment_id;
    NEW.exercise_id := OLD.exercise_id;
    NEW.learner_id := OLD.learner_id;
    NEW.created_at := OLD.created_at;
    NEW.started_at := OLD.started_at;
    -- Champs librement modifiables par l'élève en cours d'exercice :
    --   answers, item_results, time_spent_seconds, source_app
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_exercise_attempts_update ON public.exercise_attempts;
CREATE TRIGGER guard_exercise_attempts_update
  BEFORE UPDATE ON public.exercise_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_exercise_attempts_eleve_update();

-- Empêcher la suppression côté élève (la policy ALL le permettait).
-- On remplace l'ALL par INSERT + SELECT + UPDATE dédiés.
DROP POLICY IF EXISTS "learner_own_attempts" ON public.exercise_attempts;

CREATE POLICY "learner_select_own_attempts"
  ON public.exercise_attempts FOR SELECT
  USING (learner_id = auth.uid());

CREATE POLICY "learner_insert_own_attempts"
  ON public.exercise_attempts FOR INSERT
  WITH CHECK (learner_id = auth.uid() AND status = 'in_progress');

CREATE POLICY "learner_update_own_inprogress_attempts"
  ON public.exercise_attempts FOR UPDATE
  USING (learner_id = auth.uid() AND status = 'in_progress')
  WITH CHECK (learner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────
-- 7) DEVOIRS — garde-fou anti-modif des champs sensibles côté élève
-- ─────────────────────────────────────────────────────────────────────────
-- Le code élève (DevoirPassation) update statut + nb_reussites_consecutives
-- + updated_at. On préserve ce flux mais on bloque tout le reste, et on
-- empêche de modifier un devoir déjà finalisé (fait/arrete/expire/archive).

CREATE OR REPLACE FUNCTION public.guard_devoirs_eleve_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NEW.eleve_id = auth.uid()
     AND NOT has_role(auth.uid(), 'formateur'::app_role)
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN

    -- Interdire la modif d'un devoir déjà finalisé.
    IF OLD.statut IN ('fait', 'arrete', 'expire', 'archive') THEN
      RAISE EXCEPTION 'Cannot modify a finalized devoir (statut=%)', OLD.statut;
    END IF;

    -- Champs verrouillés : restaurer OLD
    NEW.id := OLD.id;
    NEW.eleve_id := OLD.eleve_id;
    NEW.exercice_id := OLD.exercice_id;
    NEW.formateur_id := OLD.formateur_id;
    NEW.session_id := OLD.session_id;
    NEW.raison := OLD.raison;
    NEW.serie := OLD.serie;
    NEW.contexte := OLD.contexte;
    NEW.date_echeance := OLD.date_echeance;
    NEW.created_at := OLD.created_at;
    NEW.archived_at := OLD.archived_at;
    NEW.archived_reason := OLD.archived_reason;
    NEW.source_label := OLD.source_label;

    -- Statut : seules les transitions légitimes côté élève sont autorisées.
    --   en_attente -> fait | arrete
    IF NEW.statut IS DISTINCT FROM OLD.statut THEN
      IF NOT (OLD.statut = 'en_attente' AND NEW.statut IN ('fait', 'arrete')) THEN
        RAISE EXCEPTION 'Illegal devoir statut transition: % -> %', OLD.statut, NEW.statut;
      END IF;
    END IF;

    -- nb_reussites_consecutives : clamp [0..10] pour éviter les valeurs aberrantes
    IF NEW.nb_reussites_consecutives < 0 OR NEW.nb_reussites_consecutives > 10 THEN
      NEW.nb_reussites_consecutives := OLD.nb_reussites_consecutives;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_devoirs_update ON public.devoirs;
CREATE TRIGGER guard_devoirs_update
  BEFORE UPDATE ON public.devoirs
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_devoirs_eleve_update();

-- Bloquer DELETE côté élève (la policy UPDATE existante autorise déjà l'élève
-- à updater, mais aucune policy DELETE n'est définie pour lui — OK).

-- ─────────────────────────────────────────────────────────────────────────
-- 8) TEST_SESSIONS — garde-fou : champs scores réservés au backend/formateur
-- ─────────────────────────────────────────────────────────────────────────
-- L'élève UPDATE test_sessions pour mettre à jour des champs de progression
-- (statut, score_*, profil_final, niveau_estime). Aujourd'hui le calcul est
-- fait côté client, c'est exactement le risque de fraude.
-- VAGUE 1 : on documente le risque via trigger et on bloque la modif des
-- champs scores une fois finalize -> évite la triche post-finalisation.
-- VAGUE 2 (TODO) : déplacer le calcul dans une RPC SECURITY DEFINER
-- `finalize_test_session` et retirer complètement l'UPDATE direct.

CREATE OR REPLACE FUNCTION public.guard_test_sessions_eleve_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NEW.apprenant_id = auth.uid()
     AND NOT has_role(auth.uid(), 'formateur'::app_role)
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN

    -- Une fois la session finalisée (statut terminé / score posé), on
    -- interdit toute modification ultérieure des champs scores et profil.
    IF OLD.statut IS NOT NULL AND OLD.statut IN ('termine', 'completed', 'finalise') THEN
      NEW.score_co := OLD.score_co;
      NEW.score_ce := OLD.score_ce;
      NEW.score_ee := OLD.score_ee;
      NEW.score_eo := OLD.score_eo;
      NEW.score_global := OLD.score_global;
      NEW.profil_final := OLD.profil_final;
      NEW.niveau_estime := OLD.niveau_estime;
      NEW.groupe_suggere := OLD.groupe_suggere;
      NEW.recommandations := OLD.recommandations;
      NEW.statut := OLD.statut;
    END IF;

    -- Champs jamais modifiables par l'élève (validation formateur)
    NEW.groupe_valide_par_formateur := OLD.groupe_valide_par_formateur;
    NEW.apprenant_id := OLD.apprenant_id;
    NEW.id := OLD.id;
    NEW.created_at := OLD.created_at;
  END IF;

  RETURN NEW;
END;
$$;

-- Création conditionnelle (la table peut ne pas avoir tous ces champs)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='test_sessions') THEN
    DROP TRIGGER IF EXISTS guard_test_sessions_update ON public.test_sessions;
    CREATE TRIGGER guard_test_sessions_update
      BEFORE UPDATE ON public.test_sessions
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_test_sessions_eleve_update();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 9) TEST_REPONSES — empêcher l'élève de toucher au score formateur
-- ─────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_test_reponses_eleve_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT has_role(auth.uid(), 'formateur'::app_role)
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    -- Champs strictement réservés au formateur / backend
    NEW.score_formateur := OLD.score_formateur;
    NEW.score_obtenu := OLD.score_obtenu;
    NEW.justification_correction := OLD.justification_correction;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='test_reponses') THEN
    DROP TRIGGER IF EXISTS guard_test_reponses_update ON public.test_reponses;
    CREATE TRIGGER guard_test_reponses_update
      BEFORE UPDATE ON public.test_reponses
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_test_reponses_eleve_update();
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- 10) TESTS_ENTREE — split ALL en INSERT + SELECT + UPDATE limité
-- ─────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='tests_entree') THEN
    -- Drop ancienne policy ALL si elle existe
    EXECUTE 'DROP POLICY IF EXISTS "Eleves manage own test" ON public.tests_entree';
    EXECUTE 'DROP POLICY IF EXISTS "Eleves manage own tests_entree" ON public.tests_entree';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.guard_tests_entree_eleve_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role'
     AND NOT has_role(auth.uid(), 'formateur'::app_role)
     AND NOT has_role(auth.uid(), 'admin'::app_role) THEN
    -- Champs scores et niveaux : verrouillés côté élève
    NEW.score_global := OLD.score_global;
    NEW.score_co := OLD.score_co;
    NEW.score_ce := OLD.score_ce;
    NEW.score_ee := OLD.score_ee;
    NEW.score_eo := OLD.score_eo;
    NEW.score_structures := OLD.score_structures;
    NEW.niveau_estime := OLD.niveau_estime;
    NEW.recommandations := OLD.recommandations;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables
             WHERE table_schema='public' AND table_name='tests_entree') THEN
    EXECUTE $POL$
      CREATE POLICY "Eleves insert own tests_entree"
        ON public.tests_entree FOR INSERT
        WITH CHECK (eleve_id = auth.uid())
    $POL$;
    EXECUTE $POL$
      CREATE POLICY "Eleves view own tests_entree"
        ON public.tests_entree FOR SELECT
        USING (eleve_id = auth.uid())
    $POL$;
    EXECUTE $POL$
      CREATE POLICY "Eleves update own tests_entree"
        ON public.tests_entree FOR UPDATE
        USING (eleve_id = auth.uid())
        WITH CHECK (eleve_id = auth.uid())
    $POL$;

    DROP TRIGGER IF EXISTS guard_tests_entree_update ON public.tests_entree;
    CREATE TRIGGER guard_tests_entree_update
      BEFORE UPDATE ON public.tests_entree
      FOR EACH ROW
      EXECUTE FUNCTION public.guard_tests_entree_eleve_update();
  END IF;
END $$;
