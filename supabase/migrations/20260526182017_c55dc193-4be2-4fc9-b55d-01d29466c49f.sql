BEGIN;

ALTER TABLE interventions
  ALTER COLUMN formateur_id DROP NOT NULL;

ALTER TABLE interventions
  ADD COLUMN IF NOT EXISTS is_systeme boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS interventions_systeme_uniq
  ON interventions (type_erreur_id, niveau_cible, competence)
  WHERE is_systeme = true;

DROP POLICY IF EXISTS interventions_select ON interventions;
CREATE POLICY interventions_select ON interventions
  FOR SELECT USING (
    (formateur_id = auth.uid())
    OR (is_systeme = true)
  );

ALTER TABLE session_live_events
  ADD COLUMN IF NOT EXISTS competence text
    CHECK (competence IN ('CO','CE','EE','EO'));

COMMIT;