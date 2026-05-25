-- ============================================================
-- SPRINT 6 — RLS : le formateur peut insérer des événements live
-- dans ses propres sessions (nécessaire pour intervention_recue)
-- ============================================================

BEGIN;

-- Remplace la politique INSERT restrictive (élève seulement)
-- par une politique qui autorise aussi le formateur de la session.
DROP POLICY IF EXISTS sle_insert       ON session_live_events;
DROP POLICY IF EXISTS sle_formateur_insert ON session_live_events;

CREATE POLICY sle_insert ON session_live_events
  FOR INSERT WITH CHECK (
    -- L'élève insère ses propres événements
    eleve_id = auth.uid()
    OR
    -- Le formateur insère dans les sessions qui lui appartiennent
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN groups g ON g.id = s.group_id
      WHERE g.formateur_id = auth.uid()
    )
  );

COMMIT;
