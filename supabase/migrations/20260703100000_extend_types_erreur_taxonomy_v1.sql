-- ============================================================
-- Taxonomie erreurs TCF IRN v1 — extension additive (11 → 16)
-- CAP TCF · Primo Fluency Hub
-- Doc : docs/taxonomie-erreurs-tcf-irn-v1.md
-- Sprint 0 RGPD : daa4a38 (prérequis classification Sprint 3)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. Cinq nouveaux types linguistiques
-- ------------------------------------------------------------

INSERT INTO types_erreur
  (id, competences, categorie, libelle_court, description, gravite_base, besoin_humain_base)
VALUES
  (
    'CO_DISCRIMINATION',
    ARRAY['CO'],
    'Phonétique',
    'Discrimination auditive',
    'Confond deux mots proches à l''oreille (ex. quinze/seize dans un horaire de préfecture).',
    2,
    0
  ),
  (
    'METHODO_REPERAGE',
    ARRAY['CE'],
    'Méthodologie',
    'Lecture non stratégique',
    'Échoue sur le repérage (date, montant, expéditeur) alors que le lexique est connu ; lecture linéaire.',
    3,
    1
  ),
  (
    'STRUCT_CONJ',
    ARRAY['ST'],
    'Grammaire',
    'Erreur de conjugaison',
    'Forme verbale erronée en QCM ou texte à trous (présent, passé composé, imparfait, futur).',
    3,
    1
  ),
  (
    'STRUCT_MORPHO',
    ARRAY['ST'],
    'Morphosyntaxe',
    'Morphosyntaxe',
    'Pronoms, prépositions, négation (ex. « je vais à le bureau », négation incomplète).',
    2,
    0
  ),
  (
    'STRUCT_CONNECTEURS',
    ARRAY['ST', 'CE', 'EE'],
    'Syntaxe',
    'Connecteurs absents ou erronés',
    'Marqueurs temporels et logiques absents ou mal employés (d''abord, ensuite, parce que, donc).',
    3,
    1
  )
ON CONFLICT (id) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Étendre competences[] des types existants (vue Structures)
-- ------------------------------------------------------------

UPDATE types_erreur
SET competences = ARRAY['EE', 'ST']
WHERE id = 'GRAM_ACCORD'
  AND NOT ('ST' = ANY(competences));

UPDATE types_erreur
SET competences = ARRAY['EE', 'EO', 'ST']
WHERE id = 'GRAM_TEMPS'
  AND NOT ('ST' = ANY(competences));

-- ------------------------------------------------------------
-- 3. Autoriser ST dans session_live_events.competence
--    (compétence d'observation pour exercices Structures purs)
-- ------------------------------------------------------------

ALTER TABLE session_live_events
  DROP CONSTRAINT IF EXISTS session_live_events_competence_check;

ALTER TABLE session_live_events
  ADD CONSTRAINT session_live_events_competence_check
  CHECK (competence IS NULL OR competence IN ('CO', 'CE', 'EE', 'EO', 'ST'));

-- ------------------------------------------------------------
-- 4. Signaux comportementaux — pas de lignes types_erreur
--    Les événements clic_aleatoire_probable, inactif, rythme_anormal,
--    aide_demandee utilisent event_type (liveEventEmitter.ts) sans
--    type_erreur_id. Famille conceptuelle categorie='Comportement'.
-- ------------------------------------------------------------

COMMENT ON TABLE types_erreur IS
  'Taxonomie linguistique TCF IRN (16 types v1). Signaux comportementaux : event_type sur session_live_events, pas de type_erreur_id.';

COMMIT;
