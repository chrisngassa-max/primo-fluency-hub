-- ============================================================================
-- VAGUE 2 : durcissement RLS final.
--
-- Principe : les calculs de score, corrections et transitions de statut
-- finalisé sont désormais portés par les edge functions submit-devoir-result
-- et finalize-test-session (en service role). Les élèves ne peuvent donc plus :
--   - INSERT directement dans `resultats` (passait avant par le client)
--   - UPDATE statut/score dans `devoirs` (déjà bloqué par trigger Vague 1,
--     on bloque maintenant via revoke complet de l'UPDATE élève)
--   - UPDATE scores dans `test_sessions` (idem)
--   - INSERT dans `test_resultats_apprenants`
--
-- Les triggers Vague 1 sont CONSERVÉS comme filet de sécurité.
-- Les écritures BRUTES restent autorisées :
--   - test_reponses (réponses au fil de l'eau, score_obtenu déjà bloqué côté
--     élève par trigger)
--   - exercise_attempts (live tracking — answers/time_spent restent ouverts)
-- ============================================================================

-- ── resultats : l'élève ne peut plus INSERT (uniquement service role) ─────
DROP POLICY IF EXISTS "Eleves insert own resultats" ON public.resultats;
-- SELECT propre conservé : la lecture reste autorisée pour afficher la correction.

-- ── devoirs : l'élève ne peut plus UPDATE (uniquement service role) ──────
-- Le trigger Vague 1 (guard_devoirs_eleve_update) reste actif comme filet.
DROP POLICY IF EXISTS "Eleves update own devoirs" ON public.devoirs;

-- ── test_sessions : on remplace ALL par SELECT/INSERT seulement ──────────
-- L'élève crée la session (INSERT), la lit (SELECT), mais ne peut plus
-- UPDATE (les paliers/scores intermédiaires + finalisation passent par
-- l'edge function ; les test_reponses portent les réponses brutes).
DROP POLICY IF EXISTS "Eleves manage own test_sessions" ON public.test_sessions;

CREATE POLICY "Eleves insert own test_sessions"
  ON public.test_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (apprenant_id = auth.uid());

CREATE POLICY "Eleves view own test_sessions"
  ON public.test_sessions
  FOR SELECT
  TO authenticated
  USING (apprenant_id = auth.uid());

-- NOTE : on NE crée PAS de policy UPDATE pour les élèves. Le trigger Vague 1
-- (guard_test_sessions_eleve_update) reste actif au cas où une UPDATE
-- arriverait via un autre canal (formateur/admin légitime).
-- Les UPDATE finalisation passent par edge function (service role → bypass).

-- ── test_resultats_apprenants : insert élève bloqué ──────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = 'public.test_resultats_apprenants'::regclass
      AND polname = 'Eleves insert own test_resultats'
  ) THEN
    EXECUTE 'DROP POLICY "Eleves insert own test_resultats" ON public.test_resultats_apprenants';
  END IF;
END$$;

-- Les SELECT (élève voit son propre résultat, formateur voit ses élèves)
-- restent inchangés.

-- ── bilan_test_results : insert élève bloqué (passera par edge function
--    plus tard si besoin ; pour l'instant, BilanTestPassation insère encore
--    directement, donc on garde la policy mais on ajoute une contrainte WITH
--    CHECK plus stricte). On laisse pour l'instant tel quel pour ne pas
--    casser le flux existant — sera durci dans une vague ultérieure si besoin.

COMMENT ON TABLE public.resultats IS
  'Vague 2 : INSERT réservé au service role (edge functions submit-devoir-result et BilanSeance).';
COMMENT ON TABLE public.devoirs IS
  'Vague 2 : UPDATE réservé au service role (edge function submit-devoir-result). Trigger guard_devoirs_eleve_update conservé comme filet.';
COMMENT ON TABLE public.test_sessions IS
  'Vague 2 : UPDATE réservé au service role (edge function finalize-test-session). Trigger guard_test_sessions_eleve_update conservé.';