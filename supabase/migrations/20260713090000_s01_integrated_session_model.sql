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
-- 3. Accès apprenant en lecture seule au contenu de séance.
-- Règle absolue : jamais de PDF/DOCX/URL de stockage côté apprenant.
-- On ne s'appuie pas seulement sur une policy RLS ligne par ligne :
-- les vues ci-dessous n'exposent structurellement PAS les colonnes
-- file_url / source_file_path, quelle que soit la ligne retournée
-- (même logique défensive que play-exercise/index.ts qui retire
-- is_live_ready de la réponse avant envoi).
--
-- Enrôlement vérifié via le chemin déjà utilisé ailleurs (migration
-- 20260707100000_curriculum_v2_pilot_link.sql) :
--   training_sessions.code = session_code
--   sessions.training_session_id = training_sessions.id
--   group_members.group_id = sessions.group_id, eleve_id = auth.uid()
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "eleves_read_session_documents_content" ON public.session_documents;
CREATE POLICY "eleves_read_session_documents_content"
  ON public.session_documents FOR SELECT TO authenticated
  USING (
    audience IN ('apprenant', 'both')
    AND pedagogical_status IN ('publishable', 'published')
    AND EXISTS (
      SELECT 1
      FROM public.training_sessions ts
      JOIN public.sessions s ON s.training_session_id = ts.id
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE ts.code = session_documents.session_code
        AND gm.eleve_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "eleves_read_session_document_links" ON public.session_document_links;
CREATE POLICY "eleves_read_session_document_links"
  ON public.session_document_links FOR SELECT TO authenticated
  USING (
    audience IN ('apprenant', 'both')
    AND EXISTS (
      SELECT 1 FROM public.exercices e
      WHERE e.id = session_document_links.linked_id
        AND e.pedagogical_status IN ('publishable', 'published')
    )
    AND EXISTS (
      SELECT 1
      FROM public.training_sessions ts
      JOIN public.sessions s ON s.training_session_id = ts.id
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE ts.code = session_document_links.session_code
        AND gm.eleve_id = auth.uid()
    )
  );

-- Sans cette policy, un apprenant ne pourrait lire ni le contenu.contenu
-- (items, consigne...) d'un exercice référencé par session_document_links :
-- les policies existantes sur exercices ne couvrent que session_exercices
-- (parcours/playlist), pas ce pont-ci.
DROP POLICY IF EXISTS "eleves_read_exercices_via_session_document_links" ON public.exercices;
CREATE POLICY "eleves_read_exercices_via_session_document_links"
  ON public.exercices FOR SELECT TO authenticated
  USING (
    pedagogical_status IN ('publishable', 'published')
    AND EXISTS (
      SELECT 1
      FROM public.session_document_links sdl
      JOIN public.training_sessions ts ON ts.code = sdl.session_code
      JOIN public.sessions s ON s.training_session_id = ts.id
      JOIN public.group_members gm ON gm.group_id = s.group_id
      WHERE sdl.linked_id = exercices.id
        AND sdl.audience IN ('apprenant', 'both')
        AND gm.eleve_id = auth.uid()
    )
  );

CREATE OR REPLACE VIEW public.session_documents_learner_view
WITH (security_invoker = true) AS
SELECT
  id, session_code, document_type, title, level, competence,
  content_html, content_json, display_order, audience,
  activity_id, block_code, pedagogical_status, version, updated_at
FROM public.session_documents;
-- Ni file_url ni source_file_path ne figurent dans cette vue : un PDF
-- ne peut structurellement pas être servi à travers elle.

GRANT SELECT ON public.session_documents_learner_view TO authenticated;

CREATE OR REPLACE VIEW public.session_document_links_learner_view
WITH (security_invoker = true) AS
SELECT
  id, session_code, linked_type, linked_id, audience,
  display_order, title, activity_id, block_code, metadata, updated_at
FROM public.session_document_links;

GRANT SELECT ON public.session_document_links_learner_view TO authenticated;

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
  ADD COLUMN IF NOT EXISTS civic_fact_ids text[] NOT NULL DEFAULT '{}';

-- Verrou déterministe : un exercice marqué civic_content ne peut
-- atteindre pedagogical_status='publishable' que si chacun de ses
-- civic_fact_ids référence un fait actif et en vigueur à la date du
-- jour. Le RAG/l'IA peuvent proposer des fact_id ; ce trigger ne fait
-- confiance qu'à la table civic_facts, jamais à l'IA seule (§9/§10 du
-- rapport de référence).
CREATE OR REPLACE FUNCTION public.check_civic_publishable()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_missing text[];
BEGIN
  IF NEW.pedagogical_status = 'publishable' AND NEW.civic_content THEN
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
    );

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'DIFF_FACT_SOURCE_EXPIRED: fait(s) civique(s) non actifs/à jour: %', v_missing;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_civic_publishable ON public.exercices;
CREATE TRIGGER trg_check_civic_publishable
  BEFORE INSERT OR UPDATE ON public.exercices
  FOR EACH ROW EXECUTE FUNCTION public.check_civic_publishable();

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
  scope text NOT NULL CHECK (scope IN ('individual', 'finished', 'class')),
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

-- Protection des colonnes de libération : learner_own_attempts (RLS
-- historique, migration 20260414211154) autorise l'apprenant à mettre
-- à jour SA PROPRE ligne sans restriction de colonne. Sans ce trigger,
-- un apprenant pourrait s'auto-libérer sa propre correction. On
-- neutralise silencieusement toute tentative non-staff de modifier
-- correction_released_at / remediation_*, et on n'autorise
-- correction_viewed_at que si une libération existe déjà.
CREATE OR REPLACE FUNCTION public.guard_exercise_attempts_release_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_staff boolean;
BEGIN
  v_is_staff := auth.role() = 'service_role'
    OR public.has_role(auth.uid(), 'formateur'::public.app_role)
    OR public.has_role(auth.uid(), 'admin'::public.app_role);

  IF NOT v_is_staff THEN
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
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_exercise_attempts_release_columns ON public.exercise_attempts;
CREATE TRIGGER trg_guard_exercise_attempts_release_columns
  BEFORE UPDATE ON public.exercise_attempts
  FOR EACH ROW EXECUTE FUNCTION public.guard_exercise_attempts_release_columns();

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

-- Fonction serveur de libération, seule voie autorisée pour poser
-- correction_released_at à distance (le trigger ci-dessus bloque
-- l'apprenant ; cette fonction vérifie explicitement que l'appelant
-- est le formateur propriétaire de l'exercice, un admin, ou le
-- service_role, avant toute écriture).
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
  v_is_authorized boolean;
  v_event_id uuid;
BEGIN
  IF p_scope NOT IN ('individual', 'finished', 'class') THEN
    RAISE EXCEPTION 'release_corrections: scope inconnu %', p_scope;
  END IF;

  SELECT (auth.role() = 'service_role') OR EXISTS (
    SELECT 1 FROM public.exercices e
    WHERE e.id = p_exercise_id
      AND (e.formateur_id = v_caller OR public.has_role(v_caller, 'admin'::public.app_role))
  ) INTO v_is_authorized;

  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'release_corrections: appelant non autorisé pour l''exercice %', p_exercise_id;
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

COMMIT;
