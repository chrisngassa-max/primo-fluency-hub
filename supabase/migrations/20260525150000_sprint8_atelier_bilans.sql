-- ============================================================
-- SPRINT 8 — Bilan de fin d'atelier
-- Mode Atelier IA · Primo Fluency Hub
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS atelier_bilans (
  id                       uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id               uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  formateur_id             uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contenu                  jsonb       NOT NULL DEFAULT '{}',
  recalibrations_appliquees boolean     NOT NULL DEFAULT false,
  created_at               timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS atelier_bilans_session_idx    ON atelier_bilans (session_id);
CREATE INDEX IF NOT EXISTS atelier_bilans_formateur_idx  ON atelier_bilans (formateur_id);

ALTER TABLE atelier_bilans ENABLE ROW LEVEL SECURITY;

CREATE POLICY atelier_bilans_select ON atelier_bilans
  FOR SELECT USING (formateur_id = auth.uid());

CREATE POLICY atelier_bilans_insert ON atelier_bilans
  FOR INSERT WITH CHECK (formateur_id = auth.uid());

CREATE POLICY atelier_bilans_update ON atelier_bilans
  FOR UPDATE USING (formateur_id = auth.uid());

COMMIT;
