-- ============================================================
-- CapTCF — Modèle canonique de séance intégrée (pilote S01)
-- Additive uniquement : aucune table/colonne/contrainte existante
-- n'est supprimée ou renommée. Toutes les nouvelles policies RLS
-- s'ajoutent aux policies existantes, elles ne les remplacent pas.
--
-- Contexte : mission "parcours interactif S01" (2026-07-13).
-- Arbitrage retenu (voir docs/pedagogie/checklist-readiness-
-- differenciation-S01.md) : implémenter les fonctionnalités
-- techniques maintenant, activer progressivement. Aucun contenu
-- n'est déclaré pédagogiquement validé par cette migration — le
-- cycle de statut ci-dessous part explicitement à 'draft'.
--
-- Sections :
--   1. session_activities — regroupement canonique "Activité X/N"
--   2. Cycle de validation pédagogique (pedagogical_status)
--   3. Accès apprenant en lecture seule (jamais de PDF) via vues
--   4. Contenu civique — base de faits officiels + verrou de publication
--   5. Moteur de libération des corrections (exercise_attempts)
--   6. Politique de correction par devoir (immediate/manual_release/scheduled)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. session_activities — regroupe des session_documents /
-- session_document_links sous un identifiant pédagogique stable
-- (ex: 'S01.ACCUEIL', 'S01.CO', 'S01.STRUCTURES', 'S01.CIVIQUE',
-- 'S01.PRODUCTION'). C'est le niveau "Activité X sur N" du parcours
-- apprenant — une couche d'organisation, pas un nouveau moteur de
-- contenu : elle référence des lignes existantes, n'en duplique aucune.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.session_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_code text NOT NULL,
  activity_code text NOT NULL,
  title text NOT NULL,
  objective text,
  display_order integer NOT NULL DEFAULT 0,
  pedagogical_status text NOT NULL DEFAULT 'draft' CHECK (pedagogical_status IN (
    'draft', 'technical_review', 'pedagogical_review', 'factual_review',
    'trainer_approved', 'publishable', 'published'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_code, activity_code)
);

CREATE INDEX IF NOT EXISTS idx_session_activities_session_order
  ON public.session_activities (session_code, display_order);

DROP TRIGGER IF EXISTS trg_session_activities_updated_at ON public.session_activities;
CREATE TRIGGER trg_session_activities_updated_at
  BEFORE UPDATE ON public.session_activities
  FOR EACH ROW EXECUTE FUNCTION public.touch_curriculum_updated_at();

ALTER TABLE public.session_activities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_all_session_activities" ON public.session_activities;
CREATE POLICY "staff_all_session_activities"
  ON public.session_activities FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_all_session_activities" ON public.session_activities;
CREATE POLICY "service_all_session_activities"
  ON public.session_activities FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Rattachement optionnel (nullable, additif) des documents/liens existants
-- à une activité canonique, + identifiant de bloc stable type
-- "S01.ACCUEIL.SUPPORT".
ALTER TABLE public.session_documents
  ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.session_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS block_code text;

ALTER TABLE public.session_document_links
  ADD COLUMN IF NOT EXISTS activity_id uuid REFERENCES public.session_activities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS block_code text;

-- Point 3 (2e relecture indépendante) : le parcours intégré n'avait aucun
-- moyen de représenter une assignation individuelle ou un bonus (contrairement
-- au modèle legacy session_exercices.eleve_id/is_bonus). Sans ça, TOUS les
-- exercices liés à une séance étaient visibles par TOUS les apprenants du
-- groupe, quel que soit leur niveau CECRL — un A1 recevait donc aussi les
-- variantes B1/B2 de la même famille. Même convention que session_exercices :
-- eleve_id NULL = exercice commun au groupe (filtré par niveau du groupe côté
-- get-seance-content) ; eleve_id renseigné = assignation individuelle
-- (toujours visible pour CET élève, quel que soit son niveau — bonus/
-- remédiation délibérément choisis par le formateur).
ALTER TABLE public.session_document_links
  ADD COLUMN IF NOT EXISTS eleve_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_bonus boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_session_document_links_eleve ON public.session_document_links (eleve_id);

CREATE INDEX IF NOT EXISTS idx_session_documents_activity ON public.session_documents (activity_id);
CREATE INDEX IF NOT EXISTS idx_session_document_links_activity ON public.session_document_links (activity_id);

-- ------------------------------------------------------------
-- 2. Cycle de validation pédagogique sur les exercices, distinct
-- de statut (pipeline éditorial existant) et validation_status
-- (QA automatique, Lot 9). Nouveau champ, non consommé par le code
-- existant : n'affecte aucun comportement en place.
-- ------------------------------------------------------------
ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS pedagogical_status text NOT NULL DEFAULT 'draft' CHECK (pedagogical_status IN (
    'draft', 'technical_review', 'pedagogical_review', 'factual_review',
    'trainer_approved', 'publishable', 'published'
  ));

CREATE INDEX IF NOT EXISTS idx_exercices_pedagogical_status ON public.exercices (pedagogical_status);

-- Même cycle sur session_documents (référencé par la policy apprenant de la
-- section 3 ci-dessous). Rétrocompatibilité : un document déjà 'valide'
-- avant cette migration est backfillé à 'published' pour ne rien masquer
-- de ce qui était déjà considéré prêt selon le cycle éditorial existant.
ALTER TABLE public.session_documents
  ADD COLUMN IF NOT EXISTS pedagogical_status text NOT NULL DEFAULT 'draft' CHECK (pedagogical_status IN (
    'draft', 'technical_review', 'pedagogical_review', 'factual_review',
    'trainer_approved', 'publishable', 'published'
  ));

UPDATE public.session_documents
  SET pedagogical_status = 'published'
  WHERE status = 'valide' AND pedagogical_status = 'draft';

-- ------------------------------------------------------------
-- 3. Accès apprenant au contenu de séance — REVU après relecture
-- indépendante (2026-07-13) : une policy RLS SELECT sur la table de BASE
-- reste une policy PAR LIGNE, pas par colonne. Un client authentifié peut
-- techniquement demander `file_url`/`source_file_path` dans son `select()`
-- et les obtenir dès lors qu'une ligne est autorisée — la vue "learner_view"
-- de la version précédente de cette migration ne protégeait donc RIEN
-- contre un appel direct à la table `session_documents` elle-même.
--
-- Nouvelle règle, structurelle : AUCUNE policy SELECT apprenant sur
-- session_documents / session_document_links / exercices (RLS deny-by-
-- default pour authenticated). Le seul chemin de lecture pour un apprenant
-- passe par les edge functions `get-seance-content` et
-- `get-attempt-correction` (service role, colonnes choisies en dur dans le
-- code TypeScript, jamais construites depuis l'input du client — voir
-- supabase/functions/get-seance-content/index.ts). Un test d'intégration
-- (tests/integration/pdf-protection.test.mjs) vérifie qu'une requête
-- authentifiée directe sur file_url échoue réellement.
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "eleves_read_session_documents_content" ON public.session_documents;
DROP POLICY IF EXISTS "eleves_read_session_document_links" ON public.session_document_links;
DROP POLICY IF EXISTS "eleves_read_exercices_via_session_document_links" ON public.exercices;
DROP VIEW IF EXISTS public.session_documents_learner_view;
DROP VIEW IF EXISTS public.session_document_links_learner_view;

-- ------------------------------------------------------------
-- 4. Base de faits civiques officiels (rapport de référence §9) +
-- verrou de publication déterministe. Gouvernance humaine (préalable
-- #11 de la checklist readiness) NON résolue par cette migration :
-- la table existe, le verrou technique existe, mais aucun processus
-- d'actualisation humaine n'est instauré ici.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.civic_facts (
  fact_id text PRIMARY KEY,
  statement text NOT NULL,
  jurisdiction text NOT NULL DEFAULT 'FR',
  scope text[] NOT NULL DEFAULT '{}',
  source_url text,
  source_type text NOT NULL DEFAULT 'official_regulation',
  effective_from date NOT NULL,
  effective_to date,
  verified_at date,
  content_hash text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'retracted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_civic_facts_updated_at ON public.civic_facts;
CREATE TRIGGER trg_civic_facts_updated_at
  BEFORE UPDATE ON public.civic_facts
  FOR EACH ROW EXECUTE FUNCTION public.touch_curriculum_updated_at();

ALTER TABLE public.civic_facts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "staff_all_civic_facts" ON public.civic_facts;
CREATE POLICY "staff_all_civic_facts"
  ON public.civic_facts FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS "service_all_civic_facts" ON public.civic_facts;
CREATE POLICY "service_all_civic_facts"
  ON public.civic_facts FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS civic_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS civic_fact_ids text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS needs_content_review boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.exercices.needs_content_review IS
  'Posé par le générateur (scripts/curriculum/generate-s01-interactive.mjs) quand un exercice autocorrigé est sous le plancher de 10 items faute de matière première réelle. Bloque publishable/published (trigger trg_check_publishable_density) tant que non corrigé manuellement.';

-- Attributs de gouvernance du fait civique lui-même (pas de l'exercice) :
-- version et validateur humain distinct de exercices.reviewed_by (qui porte
-- la revue pédagogique du contenu, pas la vérification de la véracité du
-- fait officiel).
ALTER TABLE public.civic_facts
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS validated_by uuid REFERENCES public.profiles(id);

-- Verrou déterministe, DURCI après DEUX relectures indépendantes (2026-07-13) :
-- 1) le contrôle de PALIER (pas de saut de plus d'un cran) s'applique à
--    TOUTE transition d'un exercice civique, quel que soit le statut cible —
--    la version précédente n'évaluait ce contrôle QUE lorsque NEW.pedagogical_status
--    était déjà 'publishable'/'published', ce qui laissait passer librement
--    un saut draft->trainer_approved (jamais réévalué) ;
-- 2) le contrôle de FAITS SOURCÉS (source_url/content_hash/verified_at/
--    validated_by/fenêtre effective_from-effective_to) ne s'applique qu'à
--    l'ATTEINTE de 'publishable' ou 'published' (un fait n'a pas besoin
--    d'être sourcé pour rester en pedagogical_review, par exemple).
CREATE OR REPLACE FUNCTION public.check_civic_publishable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_missing text[];
  v_rank_old integer;
  v_rank_new integer;
  v_ranks jsonb := '{"draft":0,"technical_review":1,"pedagogical_review":2,"factual_review":3,"trainer_approved":4,"publishable":5,"published":6}'::jsonb;
BEGIN
  IF NOT NEW.civic_content THEN
    RETURN NEW;
  END IF;

  -- Contrôle de palier : s'applique à CHAQUE transition, indépendamment du
  -- statut cible (corrige le bug où draft->trainer_approved n'était jamais
  -- vérifié car hors du bloc publishable/published).
  IF TG_OP = 'UPDATE' THEN
    v_rank_old := COALESCE((v_ranks -> OLD.pedagogical_status)::text::integer, 0);
    v_rank_new := (v_ranks -> NEW.pedagogical_status)::text::integer;
    IF v_rank_new - v_rank_old > 1 THEN
      RAISE EXCEPTION 'DIFF_CIVIC_STAGE_SKIPPED: un exercice civique (%) ne peut pas sauter de % à % en une seule transition', NEW.id, OLD.pedagogical_status, NEW.pedagogical_status;
    END IF;
  ELSIF NEW.pedagogical_status <> 'draft' THEN
    RAISE EXCEPTION 'DIFF_CIVIC_STAGE_SKIPPED: un exercice civique (%) doit être créé en draft, jamais directement en %', NEW.id, NEW.pedagogical_status;
  END IF;

  -- Contrôle des faits sourcés : uniquement à l'atteinte de publishable/published.
  IF NEW.pedagogical_status IN ('publishable', 'published') THEN
    IF NEW.civic_fact_ids IS NULL OR array_length(NEW.civic_fact_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'DIFF_FACT_SOURCE_UNVERIFIED: exercice civique % sans civic_fact_ids', NEW.id;
    END IF;

    SELECT array_agg(fid) INTO v_missing
    FROM unnest(NEW.civic_fact_ids) AS fid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.civic_facts cf
      WHERE cf.fact_id = fid
        AND cf.status = 'active'
        AND cf.effective_from <= current_date
        AND (cf.effective_to IS NULL OR cf.effective_to > current_date)
        AND cf.source_url IS NOT NULL
        AND cf.content_hash IS NOT NULL
        AND cf.verified_at IS NOT NULL
        AND cf.validated_by IS NOT NULL
        AND cf.version >= 1
    );

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'DIFF_FACT_SOURCE_EXPIRED: fait(s) civique(s) non actifs, non sourcés ou non validés humainement : %', v_missing;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_civic_publishable ON public.exercices;
CREATE TRIGGER trg_check_civic_publishable
  BEFORE INSERT OR UPDATE ON public.exercices
  FOR EACH ROW EXECUTE FUNCTION public.check_civic_publishable();

-- Point 9 (relecture indépendante) : un exercice marqué needs_content_review
-- ne doit jamais être publié, civique ou non.
CREATE OR REPLACE FUNCTION public.check_publishable_density()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.needs_content_review AND NEW.pedagogical_status IN ('publishable', 'published') THEN
    RAISE EXCEPTION 'DENSITY_BELOW_FLOOR: exercice % marqué needs_content_review=true, publication bloquée', NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_publishable_density ON public.exercices;
CREATE TRIGGER trg_check_publishable_density
  BEFORE INSERT OR UPDATE ON public.exercices
  FOR EACH ROW EXECUTE FUNCTION public.check_publishable_density();

-- ------------------------------------------------------------
-- 5. Moteur de libération des corrections.
-- États représentés (fonction exercise_attempt_workflow_state) :
--   not_started | in_progress | waiting_for_correction |
--   correction_released | correction_viewed | remediation_assigned
-- Note assumée explicitement : "submitted" et "waiting_for_correction"
-- ne sont PAS distingués en base, car le pipeline actuel calcule déjà
-- le score de façon synchrone à la soumission (auto-correct-exercise
-- insère directement status='completed', cf. investigation Lot A) —
-- il n'existe pas de front réel de "réponse envoyée mais pas encore
-- traitée" à représenter séparément sans réécrire ce pipeline.
-- ------------------------------------------------------------
ALTER TABLE public.exercise_attempts
  ADD COLUMN IF NOT EXISTS correction_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_viewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS remediation_exercise_id uuid REFERENCES public.exercices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remediation_assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS release_event_id uuid;

-- Rétrocompatibilité explicite : les tentatives déjà terminées avant
-- cette migration gardent leur comportement actuel (correction visible
-- immédiatement) — seules les tentatives futures passeront par le
-- moteur de libération si le devoir/l'exercice l'exige (section 6).
UPDATE public.exercise_attempts
  SET correction_released_at = COALESCE(completed_at, created_at)
  WHERE status = 'completed' AND correction_released_at IS NULL;

CREATE TABLE IF NOT EXISTS public.correction_release_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercices(id) ON DELETE CASCADE,
  released_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  scope text NOT NULL CHECK (scope IN ('individual', 'finished', 'subgroup', 'level', 'class')),
  target_eleve_ids uuid[],
  released_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'exercise_attempts_release_event_id_fkey'
  ) THEN
    ALTER TABLE public.exercise_attempts
      ADD CONSTRAINT exercise_attempts_release_event_id_fkey
      FOREIGN KEY (release_event_id) REFERENCES public.correction_release_events(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.correction_release_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formateur_read_own_release_events" ON public.correction_release_events;
CREATE POLICY "formateur_read_own_release_events"
  ON public.correction_release_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exercices e
      WHERE e.id = correction_release_events.exercise_id
        AND (e.formateur_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::public.app_role))
    )
  );

DROP POLICY IF EXISTS "service_all_release_events" ON public.correction_release_events;
CREATE POLICY "service_all_release_events"
  ON public.correction_release_events FOR ALL TO service_role
  USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');

-- Protection des colonnes de libération ET du score/de la correction.
-- DURCI après relecture indépendante (2026-07-13) : la version précédente
-- ne couvrait que l'UPDATE des colonnes de libération — elle laissait un
-- apprenant INSÉRER directement une ligne avec status='completed',
-- score_normalized et item_results arbitraires (learner_own_attempts,
-- migration 20260414211154, est une policy FOR ALL sans restriction de
-- colonne). Seul un ping de progression 'in_progress' (cf.
-- src/hooks/useLiveAttemptSync.ts, qui ne pose jamais de score) reste
-- possible pour un non-staff ; tout calcul réel de score/correction doit
-- passer par une voie service_role (edge function get-seance-content /
-- auto-correct-exercise, qui recharge exercices.contenu server-side).
CREATE OR REPLACE FUNCTION public.guard_exercise_attempts_learner_writes()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  v_is_staff := auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role);

  IF v_is_staff THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.correction_released_at IS DISTINCT FROM OLD.correction_released_at THEN
      NEW.correction_released_at := OLD.correction_released_at;
    END IF;
    IF NEW.release_event_id IS DISTINCT FROM OLD.release_event_id THEN
      NEW.release_event_id := OLD.release_event_id;
    END IF;
    IF NEW.remediation_exercise_id IS DISTINCT FROM OLD.remediation_exercise_id THEN
      NEW.remediation_exercise_id := OLD.remediation_exercise_id;
    END IF;
    IF NEW.remediation_assigned_at IS DISTINCT FROM OLD.remediation_assigned_at THEN
      NEW.remediation_assigned_at := OLD.remediation_assigned_at;
    END IF;
    IF NEW.correction_viewed_at IS DISTINCT FROM OLD.correction_viewed_at
       AND OLD.correction_released_at IS NULL THEN
      NEW.correction_viewed_at := OLD.correction_viewed_at;
    END IF;
    -- Un apprenant ne peut jamais faire passer sa propre tentative à
    -- 'completed' avec un score : seule une voie service_role calcule et
    -- pose le résultat réel. Un update non-staff reste cantonné à un ping
    -- 'in_progress' (progress/provisional), jamais une complétion.
    IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
      NEW.status := OLD.status;
      NEW.score_normalized := OLD.score_normalized;
      NEW.score_raw := OLD.score_raw;
      NEW.item_results := OLD.item_results;
      NEW.completed_at := OLD.completed_at;
      NEW.feedback_text := OLD.feedback_text;
    END IF;
  ELSE
    -- INSERT : un non-staff ne peut jamais créer directement une ligne
    -- 'completed' ni poser la moindre colonne de libération/remédiation.
    NEW.correction_released_at := NULL;
    NEW.release_event_id := NULL;
    NEW.remediation_exercise_id := NULL;
    NEW.remediation_assigned_at := NULL;
    NEW.correction_viewed_at := NULL;
    IF NEW.status = 'completed' THEN
      NEW.status := 'in_progress';
      NEW.score_normalized := NULL;
      NEW.score_raw := NULL;
      NEW.item_results := NULL;
      NEW.completed_at := NULL;
      NEW.feedback_text := NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_exercise_attempts_release_columns ON public.exercise_attempts;
DROP TRIGGER IF EXISTS trg_guard_exercise_attempts_learner_writes ON public.exercise_attempts;
CREATE TRIGGER trg_guard_exercise_attempts_learner_writes
  BEFORE INSERT OR UPDATE ON public.exercise_attempts
  FOR EACH ROW EXECUTE FUNCTION public.guard_exercise_attempts_learner_writes();

CREATE OR REPLACE FUNCTION public.exercise_attempt_workflow_state(ea public.exercise_attempts)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN ea.remediation_exercise_id IS NOT NULL THEN 'remediation_assigned'
    WHEN ea.correction_viewed_at IS NOT NULL THEN 'correction_viewed'
    WHEN ea.correction_released_at IS NOT NULL THEN 'correction_released'
    WHEN ea.status = 'completed' THEN 'waiting_for_correction'
    WHEN ea.status = 'in_progress' THEN 'in_progress'
    ELSE 'not_started'
  END
$$;

-- Autorisation liée à la SÉANCE ET AU GROUPE du formateur (relecture
-- indépendante, points 2/7) — pas seulement exercices.formateur_id, qui peut
-- être un compte technique/générateur différent du formateur qui pilote
-- réellement la séance en cours pour ce groupe. DEUX chemins de séance
-- doivent être couverts, pas un seul :
--   - le modèle LEGACY (`session_exercices`, playlist historique) ;
--   - le modèle INTÉGRÉ S01 (`session_document_links` -> `training_sessions`
--     (par code) -> `sessions` -> `groups`), qui n'existait pas encore lors
--     de la première version de cette fonction — un formateur pilotant
--     uniquement le parcours intégré (aucune ligne session_exercices) était
--     donc rejeté à tort.
-- Un appelant est autorisé s'il est service_role, admin, propriétaire
-- déclaré de l'exercice (legacy), OU formateur du groupe d'au moins une
-- séance où cet exercice est planifié/lié, par L'UN OU L'AUTRE chemin.
CREATE OR REPLACE FUNCTION public.is_authorized_for_exercise_release(p_exercise_id uuid, p_caller uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.role() = 'service_role')
    OR public.has_role(p_caller, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.exercices e
      WHERE e.id = p_exercise_id AND e.formateur_id = p_caller
    )
    OR EXISTS (
      SELECT 1
      FROM public.session_exercices se
      JOIN public.sessions s ON s.id = se.session_id
      JOIN public.groups g ON g.id = s.group_id
      WHERE se.exercice_id = p_exercise_id
        AND g.formateur_id = p_caller
    )
    OR EXISTS (
      SELECT 1
      FROM public.session_document_links sdl
      JOIN public.training_sessions ts ON ts.code = sdl.session_code
      JOIN public.sessions s ON s.training_session_id = ts.id
      JOIN public.groups g ON g.id = s.group_id
      WHERE sdl.linked_id = p_exercise_id
        AND g.formateur_id = p_caller
    );
$$;

-- Vérifie que chaque eleve_id ciblé appartient bien à un groupe où cet
-- exercice est réellement planifié/lié (legacy OU parcours intégré) —
-- empêche un formateur de "libérer" pour un élève qui n'a rien à voir avec
-- la séance de cet exercice.
CREATE OR REPLACE FUNCTION public.eleve_ids_in_exercise_scope(p_exercise_id uuid, p_eleve_ids uuid[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_eleve_ids IS NULL OR NOT EXISTS (
    SELECT 1 FROM unnest(p_eleve_ids) AS target_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.session_exercices se
      JOIN public.sessions s ON s.id = se.session_id
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE se.exercice_id = p_exercise_id AND gm.eleve_id = target_id
    ) AND NOT EXISTS (
      SELECT 1
      FROM public.session_document_links sdl
      JOIN public.training_sessions ts ON ts.code = sdl.session_code
      JOIN public.sessions s ON s.training_session_id = ts.id
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE sdl.linked_id = p_exercise_id AND gm.eleve_id = target_id
    )
  );
$$;

-- Fonction serveur de libération, seule voie autorisée pour poser
-- correction_released_at à distance (le trigger ci-dessus bloque
-- l'apprenant). Scopes réels demandés (relecture indépendante, point 7) :
-- individual (p_eleve_ids = 1 élève), subgroup (p_eleve_ids = liste choisie
-- par le formateur), level (p_eleve_ids = élèves de ce niveau, résolus côté
-- appelant via student_competency_levels/l'UI existante), finished (tous
-- les `completed` non encore libérés), class (p_eleve_ids NULL = tout le
-- groupe). "collective" n'est pas un scope de libération séparé : c'est un
-- mode d'AFFICHAGE anonymisé (voir get_exercise_response_distribution)
-- combiné à un release scope='class'.
CREATE OR REPLACE FUNCTION public.release_corrections(
  p_exercise_id uuid,
  p_eleve_ids uuid[] DEFAULT NULL,
  p_scope text DEFAULT 'individual'
)
RETURNS SETOF public.exercise_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_event_id uuid;
BEGIN
  IF p_scope NOT IN ('individual', 'finished', 'subgroup', 'level', 'class') THEN
    RAISE EXCEPTION 'release_corrections: scope inconnu %', p_scope;
  END IF;

  IF p_scope = 'individual' AND (p_eleve_ids IS NULL OR array_length(p_eleve_ids, 1) <> 1) THEN
    RAISE EXCEPTION 'release_corrections: le scope individual exige exactement un eleve_id';
  END IF;

  IF NOT public.is_authorized_for_exercise_release(p_exercise_id, v_caller) THEN
    RAISE EXCEPTION 'release_corrections: appelant non autorisé pour l''exercice % (ni propriétaire, ni formateur du groupe de séance)', p_exercise_id;
  END IF;

  IF NOT public.eleve_ids_in_exercise_scope(p_exercise_id, p_eleve_ids) THEN
    RAISE EXCEPTION 'release_corrections: au moins un eleve_id ne fait pas partie du groupe de séance de cet exercice';
  END IF;

  INSERT INTO public.correction_release_events (exercise_id, released_by, scope, target_eleve_ids)
  VALUES (p_exercise_id, v_caller, p_scope, p_eleve_ids)
  RETURNING id INTO v_event_id;

  -- Même geste de libération sur le chemin devoirs/resultats (table
  -- distincte, non synchronisée en retour par le trigger miroir — voir
  -- section 5bis), pour ne pas exiger deux clics formateur pour un seul
  -- exercice selon le chemin d'accès de l'élève.
  UPDATE public.resultats r
  SET correction_released_at = now()
  WHERE r.exercice_id = p_exercise_id
    AND r.correction_released_at IS NULL
    AND (p_eleve_ids IS NULL OR r.eleve_id = ANY(p_eleve_ids));

  RETURN QUERY
  UPDATE public.exercise_attempts ea
  SET correction_released_at = now(),
      release_event_id = v_event_id
  WHERE ea.exercise_id = p_exercise_id
    AND ea.status = 'completed'
    AND ea.correction_released_at IS NULL
    AND (p_eleve_ids IS NULL OR ea.learner_id = ANY(p_eleve_ids))
  RETURNING ea.*;
END;
$$;

-- Correction collective anonymisée (mission §"CORRECTION COLLECTIVE") :
-- distribution des réponses par item, sans jamais exposer l'identité de
-- l'élève. Autorisation identique à release_corrections.
CREATE OR REPLACE FUNCTION public.get_exercise_response_distribution(p_exercise_id uuid)
RETURNS TABLE(item_index text, reponse_normalisee text, occurrences bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_authorized_for_exercise_release(p_exercise_id, auth.uid()) THEN
    RAISE EXCEPTION 'get_exercise_response_distribution: appelant non autorisé pour l''exercice %', p_exercise_id;
  END IF;

  RETURN QUERY
  SELECT kv.key AS item_index,
         lower(trim(both from (kv.value #>> '{}'))) AS reponse_normalisee,
         count(*)::bigint AS occurrences
  FROM public.exercise_attempts ea
  CROSS JOIN LATERAL jsonb_each(COALESCE(ea.answers, '{}'::jsonb)) AS kv(key, value)
  WHERE ea.exercise_id = p_exercise_id
    AND ea.status = 'completed'
  GROUP BY kv.key, lower(trim(both from (kv.value #>> '{}')))
  ORDER BY kv.key;
END;
$$;

-- ------------------------------------------------------------
-- 5bis. Le flux devoirs/resultats (consommé par DevoirPassation.tsx) est
-- distinct d'exercise_attempts (cf. trigger mirror_resultat_to_attempt,
-- INSERT uniquement, pas de synchronisation UPDATE en retour). Pour que la
-- libération de correction fonctionne aussi sur ce chemin, on porte les
-- mêmes colonnes sur resultats. Aucune policy de garde nécessaire ici :
-- depuis la migration 20260429152920, `resultats` n'accepte déjà plus
-- d'INSERT/UPDATE élève (réservé service_role) — un apprenant ne peut donc
-- structurellement pas s'auto-libérer sa propre correction sur cette table.
-- ------------------------------------------------------------
ALTER TABLE public.resultats
  ADD COLUMN IF NOT EXISTS correction_released_at timestamptz,
  ADD COLUMN IF NOT EXISTS correction_viewed_at timestamptz;

UPDATE public.resultats
  SET correction_released_at = created_at
  WHERE correction_released_at IS NULL;

-- Permet à l'apprenant de marquer sa propre correction comme vue (seule
-- écriture qui lui reste nécessaire sur cette table verrouillée).
CREATE OR REPLACE FUNCTION public.mark_resultat_correction_viewed(p_resultat_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.resultats
  SET correction_viewed_at = now()
  WHERE id = p_resultat_id
    AND eleve_id = auth.uid()
    AND correction_released_at IS NOT NULL;
END;
$$;

-- ------------------------------------------------------------
-- 6. Politique de correction par devoir. Par défaut 'immediate'
-- (comportement actuel inchangé pour tout devoir déjà en base ou créé
-- sans précision) — comportement additif, rien n'est cassé pour S02+.
-- Le pilote S01 pourra passer explicitement en 'manual_release'.
-- ------------------------------------------------------------
ALTER TABLE public.devoirs
  ADD COLUMN IF NOT EXISTS correction_policy text NOT NULL DEFAULT 'immediate'
    CHECK (correction_policy IN ('immediate', 'manual_release', 'scheduled')),
  ADD COLUMN IF NOT EXISTS correction_release_at timestamptz;

-- ------------------------------------------------------------
-- 7. Alimentation réelle de S01 (relecture indépendante, point 4) :
-- la version précédente créait le SCHÉMA de session_activities sans
-- jamais y insérer les 7 activités ni rattacher un seul document/exercice
-- réel. Idempotent (ON CONFLICT / UPDATE ... WHERE IS NULL), sans dépendre
-- de ce que scripts/curriculum/publish-s01-interactive.mjs aura ou non
-- déjà exécuté (peut tourner avant ou après, sans effet destructif).
-- ------------------------------------------------------------
INSERT INTO public.session_activities (session_code, activity_code, title, objective, display_order, pedagogical_status)
VALUES
  ('S01', 'S01.ACCUEIL', 'Accueil et cinq thèmes civiques', 'Découvrir les cinq thèmes civiques du parcours', 1, 'draft'),
  ('S01', 'S01.LEXIQUE', 'Lexique de la séance', 'Installer les 10 mots-clés avant l''écoute du dialogue', 2, 'draft'),
  ('S01', 'S01.CO', 'Comprendre le dialogue d''accueil', 'Comprendre le parcours et ses modalités (durée, séances, évaluations)', 3, 'draft'),
  ('S01', 'S01.ATELIER', 'Atelier différencié — identité', 'Se présenter et présenter un tiers (identité, nationalité, parcours)', 4, 'draft'),
  ('S01', 'S01.STRUCTURES', 'Structures utiles', 'Travailler les structures grammaticales graduées A1 à B2', 5, 'draft'),
  ('S01', 'S01.CIVIQUE', 'Droits, devoirs et règles', 'Distinguer droit, devoir et règle', 6, 'draft'),
  ('S01', 'S01.PRODUCTION', 'Production orale et écrite', 'Réemploi communicatif : se présenter et expliquer son objectif', 7, 'draft')
ON CONFLICT (session_code, activity_code) DO NOTHING;

-- Unicité additive : permet à la procédure d'ingestion
-- (scripts/curriculum/publish-s01-interactive.mjs) de faire un vrai upsert
-- (ON CONFLICT) au lieu d'insérer un doublon à chaque exécution.
--
-- DEUX index uniques PARTIELS, pas une contrainte simple (session_code,
-- linked_id) : depuis l'ajout d'eleve_id (point 3 ci-dessus), le MÊME
-- exercice peut légitimement apparaître plusieurs fois dans la même séance
-- — une fois en lien commun (eleve_id NULL) et une fois par élève à qui il
-- est assigné individuellement (bonus/remédiation). Une contrainte UNIQUE
-- simple sur (session_code, linked_id) aurait bloqué cet usage légitime
-- (deux assignations individuelles différentes du même exercice à deux
-- élèves distincts).
--   - un seul lien COMMUN par (session_code, linked_id) [eleve_id IS NULL] ;
--   - un seul lien INDIVIDUEL par (session_code, linked_id, eleve_id).
--
-- Point 9 (2e relecture indépendante) : une contrainte ajoutée sans
-- vérification échoue silencieusement s'il existe déjà des doublons.
-- Stratégie déterministe, SANS perte d'information : pour chaque doublon,
-- conserver la ligne la plus récemment modifiée (updated_at DESC, puis id
-- DESC pour départager), tracer chaque suppression par une ligne NOTICE,
-- puis échouer avec un message explicite si des doublons subsistent malgré
-- la déduplication automatique (ne devrait jamais arriver).
DO $$
DECLARE
  v_removed_id uuid;
  v_removed_count integer := 0;
BEGIN
  -- Doublons parmi les liens COMMUNS (eleve_id IS NULL).
  FOR v_removed_id IN
    SELECT id FROM (
      SELECT id,
        row_number() OVER (PARTITION BY session_code, linked_id ORDER BY updated_at DESC, id DESC) AS rn
      FROM public.session_document_links
      WHERE eleve_id IS NULL
    ) ranked
    WHERE rn > 1
  LOOP
    DELETE FROM public.session_document_links WHERE id = v_removed_id;
    v_removed_count := v_removed_count + 1;
    RAISE NOTICE 'session_document_links : ligne % supprimée (doublon lien commun, conservée = plus récente).', v_removed_id;
  END LOOP;

  -- Doublons parmi les liens INDIVIDUELS (session_code, linked_id, eleve_id).
  FOR v_removed_id IN
    SELECT id FROM (
      SELECT id,
        row_number() OVER (PARTITION BY session_code, linked_id, eleve_id ORDER BY updated_at DESC, id DESC) AS rn
      FROM public.session_document_links
      WHERE eleve_id IS NOT NULL
    ) ranked
    WHERE rn > 1
  LOOP
    DELETE FROM public.session_document_links WHERE id = v_removed_id;
    v_removed_count := v_removed_count + 1;
    RAISE NOTICE 'session_document_links : ligne % supprimée (doublon lien individuel, conservée = plus récente).', v_removed_id;
  END LOOP;

  IF v_removed_count > 0 THEN
    RAISE NOTICE 'session_document_links : déduplication terminée, % ligne(s) supprimée(s).', v_removed_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.session_document_links WHERE eleve_id IS NULL
    GROUP BY session_code, linked_id HAVING count(*) > 1
  ) OR EXISTS (
    SELECT 1 FROM public.session_document_links WHERE eleve_id IS NOT NULL
    GROUP BY session_code, linked_id, eleve_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'MIGRATION_BLOQUEE: des doublons persistent dans session_document_links après déduplication automatique — intervention manuelle requise avant d''ajouter les index uniques.';
  END IF;
END $$;

DROP INDEX IF EXISTS session_document_links_session_linked_unique;
ALTER TABLE public.session_document_links
  DROP CONSTRAINT IF EXISTS session_document_links_session_linked_unique;

CREATE UNIQUE INDEX IF NOT EXISTS session_document_links_common_unique
  ON public.session_document_links (session_code, linked_id)
  WHERE eleve_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS session_document_links_individual_unique
  ON public.session_document_links (session_code, linked_id, eleve_id)
  WHERE eleve_id IS NOT NULL;

-- Rattache les 9 documents S01 déjà seedés (migration 20260708210100) à
-- leur activité canonique, par document_type. N'écrase jamais un
-- activity_id déjà posé manuellement (WHERE activity_id IS NULL).
UPDATE public.session_documents sd
SET activity_id = sa.id,
    block_code = 'S01.' || upper(sd.document_type)
FROM public.session_activities sa
WHERE sd.session_code = 'S01'
  AND sa.session_code = 'S01'
  AND sd.activity_id IS NULL
  AND (
    (sd.document_type IN ('support_visuel') AND sa.activity_code = 'S01.ACCUEIL')
    OR (sd.document_type IN ('lexique') AND sa.activity_code = 'S01.LEXIQUE')
    OR (sd.document_type IN ('dialogue_transcription', 'qcm_tcf') AND sa.activity_code = 'S01.CO')
    OR (sd.document_type IN ('fiche_apprenant') AND sa.activity_code = 'S01.ATELIER')
    OR (sd.document_type IN ('qcm_civique') AND sa.activity_code = 'S01.CIVIQUE')
  );
-- fiche_formateur / corrige_formateur / document_transforme restent sans
-- activity_id : ce sont des documents formateur (audience='formateur') ou
-- non encore classés — ils ne doivent de toute façon jamais être servis à
-- l'apprenant (voir section 3 : aucune policy SELECT apprenant sur cette
-- table, accès exclusivement via get-seance-content qui filtre lui-même
-- sur audience IN ('apprenant','both')).

COMMIT;
