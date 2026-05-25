-- ============================================================
-- SPRINT 5 — Bibliothèque d'interventions formateur
-- Mode Atelier IA · Primo Fluency Hub
-- ============================================================
-- Table interventions : textes et audios TTS pré-générés que le
-- formateur envoie en 1 clic à un élève (Sprint 6).
-- Le bucket Storage `interventions-audio` doit être créé
-- manuellement dans le dashboard Supabase (public, avec politique
-- d'insertion restreinte aux formateurs).
-- ============================================================

BEGIN;

CREATE TABLE IF NOT EXISTS interventions (
  id                   uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  formateur_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titre                text        NOT NULL,
  contenu_texte        text        NOT NULL,
  type_erreur_id       text        REFERENCES types_erreur(id) ON DELETE SET NULL,
  competence           text        CHECK (competence IN ('CO','CE','EE','EO')),
  niveau_cible         text        CHECK (niveau_cible IN ('A0','A1','A2','B1','B2')),
  voix                 text        NOT NULL DEFAULT 'fr-FR-Standard-A',
  audio_url            text,
  audio_generated_at   timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS interventions_formateur_idx  ON interventions (formateur_id);
CREATE INDEX IF NOT EXISTS interventions_type_erreur_idx ON interventions (type_erreur_id);

-- ── Trigger updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_interventions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_interventions_updated_at ON interventions;
CREATE TRIGGER trg_interventions_updated_at
  BEFORE UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION update_interventions_updated_at();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;

CREATE POLICY interventions_select ON interventions
  FOR SELECT USING (formateur_id = auth.uid());

CREATE POLICY interventions_insert ON interventions
  FOR INSERT WITH CHECK (formateur_id = auth.uid());

CREATE POLICY interventions_update ON interventions
  FOR UPDATE USING (formateur_id = auth.uid());

CREATE POLICY interventions_delete ON interventions
  FOR DELETE USING (formateur_id = auth.uid());

COMMIT;
