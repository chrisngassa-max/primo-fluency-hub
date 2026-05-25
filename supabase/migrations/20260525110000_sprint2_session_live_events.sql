-- ============================================================
-- SPRINT 2 — session_live_events : flux temps réel des ateliers
-- Mode Atelier IA · Primo Fluency Hub
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS session_live_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  eleve_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type     text NOT NULL CHECK (event_type IN (
    'exercice_demarre',
    'reponse_correcte',
    'reponse_incorrecte',
    'erreur_repetee',
    'rythme_anormal',
    'exercice_termine',
    'aide_demandee',
    'intervention_recue',
    'fiche_terminee',
    'inactif',
    'clic_aleatoire_probable',
    'session_state_change',
    'eleve_state_change'
  )),
  payload        jsonb DEFAULT '{}',
  type_erreur_id text REFERENCES types_erreur(id) ON DELETE SET NULL,
  priorite_score numeric,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sle_session_id   ON session_live_events(session_id);
CREATE INDEX IF NOT EXISTS idx_sle_eleve_id     ON session_live_events(eleve_id);
CREATE INDEX IF NOT EXISTS idx_sle_created_at   ON session_live_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sle_event_type   ON session_live_events(session_id, event_type);

ALTER TABLE session_live_events ENABLE ROW LEVEL SECURITY;

-- Élèves : INSERT uniquement pour leurs propres événements
CREATE POLICY "sle_insert_eleve"
  ON session_live_events FOR INSERT
  TO authenticated
  WITH CHECK (eleve_id = auth.uid());

-- Formateurs : SELECT sur les séances de leurs groupes
CREATE POLICY "sle_select_formateur"
  ON session_live_events FOR SELECT
  TO authenticated
  USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON g.id = s.group_id
      WHERE g.formateur_id = auth.uid()
    )
    OR eleve_id = auth.uid()
  );

-- Activation Realtime (nécessite un super-utilisateur ou le dashboard Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE session_live_events;

COMMIT;
