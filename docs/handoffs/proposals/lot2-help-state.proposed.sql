-- PROPOSITION DOCUMENTAIRE UNIQUEMENT — NE PAS APPLIQUER.
-- Hors supabase/migrations. Aucun appelant, aucune fonction publique.
-- Hypothèse NON VALIDÉE : une tentative serveur stable est ouverte avant
-- toute aide/écoute et finalisée sous le même id. Voir lot2-help-state.md.
-- Ce DDL propose le stockage ; il ne réalise PAS l'autorisation métier,
-- la consommation transactionnelle, ni la distribution audio protégée.
-- Uniquement après décision sur le cycle ET autorisation de migration.
BEGIN;

-- Un seul modèle métier : exercise_attempts. Les tables ci-dessous sont
-- un état technique et des reçus, pas une seconde tentative ou file Atelier.
CREATE SCHEMA captcf_help_private;
REVOKE ALL ON SCHEMA captcf_help_private FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE captcf_help_private.attempt_state (
  attempt_id uuid PRIMARY KEY REFERENCES public.exercise_attempts(id) ON DELETE RESTRICT,
  -- Mode et versions scellés par le futur chemin serveur, jamais par le client.
  pedagogical_mode text NOT NULL CHECK (pedagogical_mode IN ('entrainement', 'devoir', 'evaluation')),
  facts_hash text NOT NULL CHECK (facts_hash ~ '^sha256:[0-9a-f]{64}$'),
  contract_version text NOT NULL CHECK (length(contract_version) BETWEEN 1 AND 128),
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  CHECK (closed_at IS NULL OR closed_at >= created_at)
);

-- Une ligne par item pour les indices ; une ligne par audio pour les écoutes.
-- Pas de budget audio par item : cela multiplierait le quota d'un même audio.
CREATE TABLE captcf_help_private.resource_state (
  attempt_id uuid NOT NULL REFERENCES captcf_help_private.attempt_state(attempt_id) ON DELETE RESTRICT,
  resource_kind text NOT NULL CHECK (resource_kind IN ('hint', 'audio')),
  -- Clé interne issue du contenu serveur scellé ; jamais une URL signée.
  resource_key text NOT NULL CHECK (length(resource_key) BETWEEN 1 AND 256),
  consumed integer NOT NULL DEFAULT 0 CHECK (consumed >= 0),
  allowance integer NOT NULL CHECK (allowance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, resource_kind, resource_key),
  CHECK (consumed <= allowance),
  CHECK (resource_kind <> 'hint' OR allowance <= 3)
);

-- Tous les reçus de la tentative sont conservés jusqu'à sa purge autorisée.
-- Ne stocker que le dernier jeton ne protégerait pas contre une répétition
-- ancienne après d'autres demandes. Aucun texte d'indice/correction ici.
CREATE TABLE captcf_help_private.request_receipt (
  attempt_id uuid NOT NULL,
  request_id uuid NOT NULL,
  resource_kind text NOT NULL,
  resource_key text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('next_hint', 'initial_audio', 'replay_audio')),
  -- Empreinte serveur des arguments normalisés : même jeton + autre action
  -- doit être refusé. Ne jamais accepter une empreinte fournie par le client.
  request_fingerprint text NOT NULL CHECK (request_fingerprint ~ '^[0-9a-f]{64}$'),
  granted_ordinal integer NOT NULL CHECK (granted_ordinal > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, request_id),
  FOREIGN KEY (attempt_id, resource_kind, resource_key)
    REFERENCES captcf_help_private.resource_state(attempt_id, resource_kind, resource_key)
    ON DELETE RESTRICT,
  CHECK ((resource_kind = 'hint' AND operation = 'next_hint') OR
         (resource_kind = 'audio' AND operation IN ('initial_audio', 'replay_audio')))
);

ALTER TABLE captcf_help_private.attempt_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE captcf_help_private.resource_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE captcf_help_private.request_receipt ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA captcf_help_private FROM PUBLIC, anon, authenticated, service_role;

-- Aucune policy ni GRANT applicatif : stockage volontairement inaccessible
-- tant que les RPC autoritatives et leurs tests ne sont pas conçus/validés.
-- Aucun backfill ni modification des tentatives/résultats/exercices existants.
COMMIT;
