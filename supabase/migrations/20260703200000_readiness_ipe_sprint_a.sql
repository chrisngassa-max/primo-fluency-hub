-- ============================================================
-- Sprint A — IPE readiness engine (readiness_config + snapshots)
-- CAP TCF · Primo Fluency Hub · algo_version 1
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.readiness_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  algo_version integer NOT NULL,
  config jsonb NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_config_active
  ON public.readiness_config (active, algo_version DESC);

CREATE TABLE IF NOT EXISTS public.readiness_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eleve_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  competence text NOT NULL CHECK (competence IN ('CO', 'CE', 'EE', 'EO', 'ST', 'GLOBAL')),
  score numeric(5, 2) NOT NULL CHECK (score >= 0 AND score <= 100),
  bande text NOT NULL CHECK (bande IN ('fragile', 'construction', 'proche_seuil', 'pret')),
  confiance text NOT NULL CHECK (confiance IN ('haute', 'moyenne', 'insuffisante')),
  composantes jsonb NOT NULL DEFAULT '{}'::jsonb,
  algo_version integer NOT NULL,
  window_start timestamptz NOT NULL,
  window_end timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_eleve_id
  ON public.readiness_snapshots (eleve_id);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_created_at
  ON public.readiness_snapshots (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_readiness_snapshots_eleve_comp_created
  ON public.readiness_snapshots (eleve_id, competence, created_at DESC);

ALTER TABLE public.readiness_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "readiness_config_read_authenticated" ON public.readiness_config;
CREATE POLICY "readiness_config_read_authenticated"
  ON public.readiness_config FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "readiness_config_service_write" ON public.readiness_config;
CREATE POLICY "readiness_config_service_write"
  ON public.readiness_config FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "readiness_snapshots_eleve_read_own" ON public.readiness_snapshots;
CREATE POLICY "readiness_snapshots_eleve_read_own"
  ON public.readiness_snapshots FOR SELECT TO authenticated
  USING (eleve_id = auth.uid());

DROP POLICY IF EXISTS "readiness_snapshots_formateur_read_group" ON public.readiness_snapshots;
CREATE POLICY "readiness_snapshots_formateur_read_group"
  ON public.readiness_snapshots FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.group_members gm
      JOIN public.groups g ON g.id = gm.group_id
      WHERE gm.eleve_id = readiness_snapshots.eleve_id
        AND g.formateur_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "readiness_snapshots_service_insert" ON public.readiness_snapshots;
CREATE POLICY "readiness_snapshots_service_insert"
  ON public.readiness_snapshots FOR INSERT TO service_role
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "readiness_snapshots_service_all" ON public.readiness_snapshots;
CREATE POLICY "readiness_snapshots_service_all"
  ON public.readiness_snapshots FOR ALL TO service_role
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Seed readiness_config_v1 (identique au fichier _shared/readiness_config_v1.json)
DELETE FROM public.readiness_config WHERE algo_version = 1;

INSERT INTO public.readiness_config (algo_version, config, active)
VALUES (
  1,
  $readiness_cfg$
{
  "algo_version": 1,
  "disclaimer_fr": "Cette jauge est une estimation pédagogique interne fondée sur les données d'entraînement. Elle constitue une aide à la décision pour le formateur et ne garantit en aucun cas le score officiel (sur 699) délivré par France Éducation international au TCF IRN.",
  "cecrl_to_scale": {"PRE_A1": 1, "A1": 2, "A2": 4, "A2_PLUS": 5, "B1": 7, "B1_PLUS": 8, "B2": 10},
  "objectifs": {
    "_comment": "L'objectif est lu depuis parcours.niveau_cible (+ parcours.type_demarche), jamais posé en dur par groupe.",
    "A2": {"libelle": "Carte de résident", "niveau_requis_scale": 4},
    "B1": {"libelle": "Naturalisation", "niveau_requis_scale": 7}
  },
  "bands": {
    "_comment": "Identiques pour tous les objectifs : la jauge mesure la distance à SA cible.",
    "fragile": {"min": 0, "max": 40, "message_formateur": "Les bases pour cet objectif ne sont pas encore acquises.", "recommandation": "Ne pas inscrire à l'examen. Risque d'échec élevé."},
    "construction": {"min": 41, "max": 65, "message_formateur": "L'apprenant progresse mais des blocages persistants demeurent.", "recommandation": "Cibler les erreurs récurrentes (voir détail des blocages)."},
    "proche_seuil": {"min": 66, "max": 84, "message_formateur": "Le niveau est presque atteint, manque de régularité.", "recommandation": "Proposer un TCF blanc. Inscription envisageable à moyen terme."},
    "pret": {"min": 85, "max": 100, "message_formateur": "Profil solide : compétences validées de manière régulière sur 28 jours.", "recommandation": "Indicateur favorable à l'inscription (ne garantit pas le résultat officiel)."}
  },
  "competency_weights": {"_comment": "Les 4 épreuves réelles du TCF IRN, équipondérées. ST n'est PAS une 5e épreuve : voir structural_moderator.", "CO": 0.25, "CE": 0.25, "EE": 0.25, "EO": 0.25},
  "structural_moderator": {
    "_comment": "Le socle Structures plafonne EE et EO quand il est fragile (les correcteurs FEI pénalisent lourdement la grammaire en production). Il n'entre jamais additivement dans le score global.",
    "enabled": true,
    "applies_to": ["EE", "EO"],
    "cap_value": 65,
    "fragile_threshold_by_objectif": {"A2": 40, "B1": 60}
  },
  "component_weights": {
    "_comment": "Poids Gemini adoptés pour l'algo_version 1 ; la calibration (Sprint D) les ajustera sur les résultats de positionnement réels.",
    "maitrise_periode": 0.40,
    "preuve_examen": 0.30,
    "niveau_valide": 0.20,
    "penalite_erreurs": 0.10,
    "fallback_if_no_exam": {
      "_comment": "Si aucun test blanc / positionnement récent (test_resultats_apprenants, dernier_score_phase2_*), le poids preuve_examen bascule sur maitrise_periode et le flag confiance passe à 'moyenne'.",
      "maitrise_periode": 0.70,
      "niveau_valide": 0.20,
      "penalite_erreurs": 0.10
    }
  },
  "maitrise_periode": {
    "window_days": 28,
    "difficulty_filter": "exercices.difficulte >= (niveau_requis_scale - 1)",
    "_comment_filter": "On mesure la réussite AU niveau de l'examen : un 90 % sur des exercices faciles ne compte pas comme préparation.",
    "min_success_rate_by_objectif": {"A2": 60, "B1": 65},
    "excluded_results": "resultats liés à des events categorie='Comportement' (clic aléatoire, abandon) — jamais dans les stats de niveau"
  },
  "penalite_erreurs": {
    "_comment": "Pénalité CONTINUE (pas de falaise à 0) : pente lisible, courbe de progression stable. La gravité vient de types_erreur.gravite_base, déjà en base (2 à 5).",
    "formula": "min(1, somme_sur_types( occurrences_non_resolues_28j * (gravite_base / 5) ) / normalisation)",
    "normalisation": 10,
    "non_resolue_definition": "recidive du même type_erreur_id après intervention_recue dans la fenêtre (signal I5)",
    "window_days": 28,
    "cap": 1.0
  },
  "alert_flags": {
    "_comment": "Ex-'erreurs rédhibitoires' de Gemini : drapeaux d'alerte formateur (bandeau rouge sur la fiche), PAS des couperets de score. Codes RÉELS de types_erreur uniquement — mapping effectué depuis les codes inventés du référentiel Gemini.",
    "codes": ["HORS_SUJET", "COHERENCE_ADMIN", "PRODUCTION_COURTE", "REGISTRE", "INTERPRETATION", "CO_DISCRIMINATION", "STRUCT_MORPHO"],
    "trigger": "3 occurrences ou plus du même code sur 14 jours",
    "mapping_source_gemini": {
      "EE_HORS_SUJET": "HORS_SUJET",
      "CO_PIEGE_PHONO": "CO_DISCRIMINATION",
      "CE_LEX_ADMIN": "LEX_CONFUSION (competence=CE)",
      "CO_SENS_GLOB": "INTERPRETATION (competence=CO)",
      "CE_INFERENCE": "INTERPRETATION (competence=CE)",
      "EE_PRAG_REGISTRE": "REGISTRE",
      "GRAM_TEMPS_PASSE": "GRAM_TEMPS",
      "GRAM_SYNTAXE_BASE": "STRUCT_MORPHO",
      "EO_FLUIDITE_BLOQUANTE": "NON MONITORABLE V1 (analyse des silences audio non captée) — proxy : PRODUCTION_COURTE en EO",
      "EO_INTERACTION_FAIBLE": "approximé par CONSIGNE_NC (competence=EO) — fiabilité moyenne"
    }
  },
  "structures_socle": {
    "_comment": "Seuils 'socle OK' rectifiés (l'inversion 65/60 du référentiel Gemini aurait exigé moins de grammaire pour la naturalisation que pour la résidence).",
    "min_success_rate_by_objectif": {"A2": 60, "B1": 65},
    "priorites_A2": ["présent verbes usuels (être, avoir, aller, faire, prendre, vouloir, pouvoir)", "futur proche", "interrogation simple (est-ce que, où, quand, combien)", "articles définis/indéfinis/partitifs"],
    "priorites_B1": ["alternance imparfait/passé composé (critique EE/EO)", "conditionnel de politesse (formules figées)", "connecteurs logiques de base (parce que, mais, donc, alors)", "pronoms relatifs simples (qui, que)"],
    "hors_scope_v1": ["passé simple", "plus-que-parfait", "subjonctif (hors 'il faut que')", "conditionnel passé"]
  },
  "confidence_rules": {
    "min_items_evaluated_28d": 15,
    "message_insuffisant": "Données insuffisantes pour une estimation fiable",
    "staleness_days": 21,
    "staleness_effect": "la confiance baisse (haute -> moyenne -> insuffisante), jamais le score",
    "no_exam_proof_effect": "confiance plafonnée à 'moyenne' tant qu'aucune preuve en conditions d'examen n'existe"
  },
  "transversal_vocabulaire": {
    "_comment": "Indicateurs d'alerte formateur, sans impact direct sur l'IPE.",
    "dictionary_density_alert": 0.15,
    "retention_carnet_min": 0.70,
    "lexique_irn_actif": "détection d'une liste fermée de mots clés intégration dans reponses_eleve (préfecture, rendez-vous, renouvellement, bail, ordonnance, embauche, attestation, justificatif...) — liste à valider pédagogiquement, ~30 mots"
  },
  "affichage": {
    "eleve_visible": false,
    "_comment_eleve": "L'IPE n'est jamais montré à l'élève en v1 (effet Goodhart + découragement) ; la Progression élève actuelle reste inchangée.",
    "ordre_lecture": ["bande", "tendance_vs_snapshot_precedent", "score_numerique"],
    "mention_obligatoire": "Estimation — en cours de calibration"
  }
}
$readiness_cfg$::jsonb,
  true
);

COMMIT;
