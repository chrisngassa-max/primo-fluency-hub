-- ============================================================
-- SPRINT 1 — Niveaux par compétence + profil littératie + taxonomie d'erreurs
-- Mode Atelier IA · Primo Fluency Hub
-- ============================================================
-- Stratégie : 3 phases pour profils_eleves, aucune donnée perdue.
-- niveau_cecrl enum existant n'inclut pas 'A0' → colonnes en text avec CHECK dédié.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Extension de profils_eleves
-- ------------------------------------------------------------

-- Phase A : colonnes nullables (rollback safe)
ALTER TABLE profils_eleves
  ADD COLUMN IF NOT EXISTS niveau_co text,
  ADD COLUMN IF NOT EXISTS niveau_ce text,
  ADD COLUMN IF NOT EXISTS niveau_ee text,
  ADD COLUMN IF NOT EXISTS niveau_eo text,
  ADD COLUMN IF NOT EXISTS niveau_source text DEFAULT 'manuel'
    CHECK (niveau_source IN ('placement_test','manuel','recalibrage_auto')),
  ADD COLUMN IF NOT EXISTS niveau_locked boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS niveau_updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS profil_litteratie text DEFAULT 'standard'
    CHECK (profil_litteratie IN ('standard','faible_litteratie'));

-- Phase B : reprise du niveau_actuel existant pour les 4 compétences
-- niveau_actuel est de type niveau_cecrl ENUM (A1..C1), cast text requis
UPDATE profils_eleves
SET niveau_co = COALESCE(niveau_actuel::text, 'A1'),
    niveau_ce = COALESCE(niveau_actuel::text, 'A1'),
    niveau_ee = COALESCE(niveau_actuel::text, 'A1'),
    niveau_eo = COALESCE(niveau_actuel::text, 'A1')
WHERE niveau_co IS NULL;

-- Phase C : NOT NULL + DEFAULT pour les futurs INSERT
ALTER TABLE profils_eleves
  ALTER COLUMN niveau_co SET NOT NULL,
  ALTER COLUMN niveau_ce SET NOT NULL,
  ALTER COLUMN niveau_ee SET NOT NULL,
  ALTER COLUMN niveau_eo SET NOT NULL,
  ALTER COLUMN niveau_co SET DEFAULT 'A1',
  ALTER COLUMN niveau_ce SET DEFAULT 'A1',
  ALTER COLUMN niveau_ee SET DEFAULT 'A1',
  ALTER COLUMN niveau_eo SET DEFAULT 'A1';

-- Contraintes sur les valeurs acceptées (A0 inclus, absent de l'ancien enum)
ALTER TABLE profils_eleves
  ADD CONSTRAINT chk_niveau_co CHECK (niveau_co IN ('A0','A1','A2','B1','B2')),
  ADD CONSTRAINT chk_niveau_ce CHECK (niveau_ce IN ('A0','A1','A2','B1','B2')),
  ADD CONSTRAINT chk_niveau_ee CHECK (niveau_ee IN ('A0','A1','A2','B1','B2')),
  ADD CONSTRAINT chk_niveau_eo CHECK (niveau_eo IN ('A0','A1','A2','B1','B2'));

-- ------------------------------------------------------------
-- 2. Trigger d'audit sur niveau_updated_at
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_niveau_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.niveau_co, NEW.niveau_ce, NEW.niveau_ee, NEW.niveau_eo)
     IS DISTINCT FROM
     (OLD.niveau_co, OLD.niveau_ce, OLD.niveau_ee, OLD.niveau_eo) THEN
    NEW.niveau_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_niveau_updated_at ON profils_eleves;
CREATE TRIGGER trg_niveau_updated_at
  BEFORE UPDATE ON profils_eleves
  FOR EACH ROW
  EXECUTE FUNCTION update_niveau_timestamp();

-- ------------------------------------------------------------
-- 3. Table types_erreur (taxonomie courte V1)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS types_erreur (
  id text PRIMARY KEY,
  competences text[] NOT NULL DEFAULT '{}',
  categorie text NOT NULL,
  libelle_court text NOT NULL,
  description text,
  gravite_base int DEFAULT 2 CHECK (gravite_base BETWEEN 1 AND 5),
  besoin_humain_base int DEFAULT 0 CHECK (besoin_humain_base BETWEEN 0 AND 3),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE types_erreur ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "types_erreur_lecture_authentifiee" ON types_erreur;
CREATE POLICY "types_erreur_lecture_authentifiee"
  ON types_erreur FOR SELECT
  TO authenticated
  USING (true);

-- ------------------------------------------------------------
-- 4. Seed des 11 types d'erreur
-- ------------------------------------------------------------

INSERT INTO types_erreur
  (id, competences, categorie, libelle_court, description, gravite_base, besoin_humain_base)
VALUES
  ('LEX_CONFUSION',     ARRAY['CO','CE','EE'],       'Lexique',          'Confusion lexicale',      'Faux ami, paronyme ou mot utilisé dans le mauvais contexte.', 2, 0),
  ('CONSIGNE_NC',       ARRAY['CO','CE','EE','EO'],  'Méthodologie',     'Consigne non respectée',  'Incompréhension de la tâche demandée.',                       4, 1),
  ('GRAM_ACCORD',       ARRAY['EE'],                 'Grammaire',        'Erreur d''accord',        'Accord sujet-verbe ou nom-adjectif incorrect.',               2, 0),
  ('GRAM_TEMPS',        ARRAY['EE','EO'],            'Grammaire',        'Erreur de temps',         'Temps verbal inadéquat.',                                     3, 1),
  ('HORS_SUJET',        ARRAY['EE','EO'],            'Méthodologie',     'Hors sujet',              'La production ne répond pas à la situation proposée.',        5, 2),
  ('INTERPRETATION',    ARRAY['CE','CO'],            'Compréhension',    'Fausse interprétation',   'Contresens sur un document écrit ou audio.',                  4, 3),
  ('JUSTIFICATION',     ARRAY['EE','EO'],            'Argumentation',    'Manque de justification', 'Absence d''arguments ou justification insuffisante.',          3, 2),
  ('PHONO',             ARRAY['EO'],                 'Phonétique',       'Prononciation',           'Erreur de son qui gêne la compréhension.',                    2, 0),
  ('PRODUCTION_COURTE', ARRAY['EE','EO'],            'Méthodologie',     'Production trop courte',  'Nombre de mots ou durée insuffisants par rapport à la consigne.', 4, 1),
  ('REGISTRE',          ARRAY['EE','EO'],            'Sociolinguistique','Erreur de registre',      'Tutoiement au lieu du vouvoiement, ton inadapté.',            3, 1),
  ('COHERENCE_ADMIN',   ARRAY['CO','CE','EE','EO'],  'Pragmatique',      'Incohérence formulaire',  'Ex : date saisie dans un champ téléphone.',                   5, 1)
ON CONFLICT (id) DO NOTHING;

COMMIT;
