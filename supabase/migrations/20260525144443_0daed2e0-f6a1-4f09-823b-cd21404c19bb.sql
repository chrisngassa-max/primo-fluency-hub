-- SPRINT 1: niveaux par compétence + profil littératie + types_erreur
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

UPDATE profils_eleves
SET niveau_co = COALESCE(niveau_actuel::text, 'A1'),
    niveau_ce = COALESCE(niveau_actuel::text, 'A1'),
    niveau_ee = COALESCE(niveau_actuel::text, 'A1'),
    niveau_eo = COALESCE(niveau_actuel::text, 'A1')
WHERE niveau_co IS NULL;

ALTER TABLE profils_eleves
  ALTER COLUMN niveau_co SET NOT NULL,
  ALTER COLUMN niveau_ce SET NOT NULL,
  ALTER COLUMN niveau_ee SET NOT NULL,
  ALTER COLUMN niveau_eo SET NOT NULL,
  ALTER COLUMN niveau_co SET DEFAULT 'A1',
  ALTER COLUMN niveau_ce SET DEFAULT 'A1',
  ALTER COLUMN niveau_ee SET DEFAULT 'A1',
  ALTER COLUMN niveau_eo SET DEFAULT 'A1';

ALTER TABLE profils_eleves DROP CONSTRAINT IF EXISTS chk_niveau_co;
ALTER TABLE profils_eleves DROP CONSTRAINT IF EXISTS chk_niveau_ce;
ALTER TABLE profils_eleves DROP CONSTRAINT IF EXISTS chk_niveau_ee;
ALTER TABLE profils_eleves DROP CONSTRAINT IF EXISTS chk_niveau_eo;
ALTER TABLE profils_eleves
  ADD CONSTRAINT chk_niveau_co CHECK (niveau_co IN ('A0','A1','A2','B1','B2')),
  ADD CONSTRAINT chk_niveau_ce CHECK (niveau_ce IN ('A0','A1','A2','B1','B2')),
  ADD CONSTRAINT chk_niveau_ee CHECK (niveau_ee IN ('A0','A1','A2','B1','B2')),
  ADD CONSTRAINT chk_niveau_eo CHECK (niveau_eo IN ('A0','A1','A2','B1','B2'));

CREATE OR REPLACE FUNCTION public.update_niveau_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.niveau_co, NEW.niveau_ce, NEW.niveau_ee, NEW.niveau_eo)
     IS DISTINCT FROM
     (OLD.niveau_co, OLD.niveau_ce, OLD.niveau_ee, OLD.niveau_eo) THEN
    NEW.niveau_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_niveau_updated_at ON profils_eleves;
CREATE TRIGGER trg_niveau_updated_at
  BEFORE UPDATE ON profils_eleves
  FOR EACH ROW EXECUTE FUNCTION public.update_niveau_timestamp();

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
CREATE POLICY "types_erreur_lecture_authentifiee" ON types_erreur FOR SELECT TO authenticated USING (true);

INSERT INTO types_erreur (id, competences, categorie, libelle_court, description, gravite_base, besoin_humain_base) VALUES
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

-- SPRINT 2: session_live_events
CREATE TABLE IF NOT EXISTS session_live_events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  eleve_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  event_type     text NOT NULL CHECK (event_type IN (
    'exercice_demarre','reponse_correcte','reponse_incorrecte','erreur_repetee',
    'rythme_anormal','exercice_termine','aide_demandee','intervention_recue',
    'fiche_terminee','inactif','clic_aleatoire_probable','session_state_change','eleve_state_change'
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

DROP POLICY IF EXISTS "sle_insert_eleve" ON session_live_events;
DROP POLICY IF EXISTS "sle_select_formateur" ON session_live_events;
CREATE POLICY "sle_select_formateur" ON session_live_events FOR SELECT TO authenticated
  USING (
    session_id IN (SELECT s.id FROM sessions s JOIN groups g ON g.id = s.group_id WHERE g.formateur_id = auth.uid())
    OR eleve_id = auth.uid()
  );

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE session_live_events';
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;

-- SPRINT 3: trigger erreur_repetee
CREATE OR REPLACE FUNCTION public.detect_erreur_repetee()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count int; v_facteur numeric; v_gravite int; v_besoin_humain int; v_priorite numeric;
BEGIN
  IF NEW.event_type <> 'reponse_incorrecte' OR NEW.type_erreur_id IS NULL OR NEW.eleve_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT COUNT(*) INTO v_count FROM session_live_events
  WHERE session_id = NEW.session_id AND eleve_id = NEW.eleve_id
    AND type_erreur_id = NEW.type_erreur_id AND event_type = 'reponse_incorrecte'
    AND created_at >= NOW() - INTERVAL '10 minutes';
  v_facteur := LEAST(2.5, 1.0 + 0.3 * (v_count - 1));
  SELECT COALESCE(gravite_base, 2), COALESCE(besoin_humain_base, 0)
    INTO v_gravite, v_besoin_humain FROM types_erreur WHERE id = NEW.type_erreur_id;
  v_priorite := v_gravite * v_besoin_humain * v_facteur;
  UPDATE session_live_events SET priorite_score = v_priorite WHERE id = NEW.id;
  IF v_count = 3 THEN
    INSERT INTO session_live_events (session_id, eleve_id, event_type, type_erreur_id, priorite_score, payload)
    VALUES (NEW.session_id, NEW.eleve_id, 'erreur_repetee', NEW.type_erreur_id, v_priorite,
      jsonb_build_object('occurrences', v_count, 'facteur_repetition', v_facteur, 'gravite', v_gravite));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_detect_erreur_repetee ON session_live_events;
CREATE TRIGGER trg_detect_erreur_repetee AFTER INSERT ON session_live_events
  FOR EACH ROW EXECUTE FUNCTION public.detect_erreur_repetee();

-- SPRINT 5: interventions
CREATE TABLE IF NOT EXISTS interventions (
  id                   uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  formateur_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  titre                text NOT NULL,
  contenu_texte        text NOT NULL,
  type_erreur_id       text REFERENCES types_erreur(id) ON DELETE SET NULL,
  competence           text CHECK (competence IN ('CO','CE','EE','EO')),
  niveau_cible         text CHECK (niveau_cible IN ('A0','A1','A2','B1','B2')),
  voix                 text NOT NULL DEFAULT 'fr-FR-Standard-A',
  audio_url            text,
  audio_generated_at   timestamptz,
  created_at           timestamptz NOT NULL DEFAULT NOW(),
  updated_at           timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS interventions_formateur_idx  ON interventions (formateur_id);
CREATE INDEX IF NOT EXISTS interventions_type_erreur_idx ON interventions (type_erreur_id);

CREATE OR REPLACE FUNCTION public.update_interventions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_interventions_updated_at ON interventions;
CREATE TRIGGER trg_interventions_updated_at BEFORE UPDATE ON interventions
  FOR EACH ROW EXECUTE FUNCTION public.update_interventions_updated_at();

ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS interventions_select ON interventions;
DROP POLICY IF EXISTS interventions_insert ON interventions;
DROP POLICY IF EXISTS interventions_update ON interventions;
DROP POLICY IF EXISTS interventions_delete ON interventions;
CREATE POLICY interventions_select ON interventions FOR SELECT USING (formateur_id = auth.uid());
CREATE POLICY interventions_insert ON interventions FOR INSERT WITH CHECK (formateur_id = auth.uid());
CREATE POLICY interventions_update ON interventions FOR UPDATE USING (formateur_id = auth.uid());
CREATE POLICY interventions_delete ON interventions FOR DELETE USING (formateur_id = auth.uid());

-- SPRINT 6: INSERT policy sur session_live_events (élève + formateur)
DROP POLICY IF EXISTS sle_insert ON session_live_events;
DROP POLICY IF EXISTS sle_formateur_insert ON session_live_events;
CREATE POLICY sle_insert ON session_live_events FOR INSERT TO authenticated WITH CHECK (
  eleve_id = auth.uid()
  OR session_id IN (SELECT s.id FROM sessions s JOIN groups g ON g.id = s.group_id WHERE g.formateur_id = auth.uid())
);

-- SPRINT 8: atelier_bilans
CREATE TABLE IF NOT EXISTS atelier_bilans (
  id                        uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id                uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  formateur_id              uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contenu                   jsonb NOT NULL DEFAULT '{}',
  recalibrations_appliquees boolean NOT NULL DEFAULT false,
  created_at                timestamptz NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS atelier_bilans_session_idx ON atelier_bilans (session_id);
CREATE INDEX IF NOT EXISTS atelier_bilans_formateur_idx ON atelier_bilans (formateur_id);
ALTER TABLE atelier_bilans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS atelier_bilans_select ON atelier_bilans;
DROP POLICY IF EXISTS atelier_bilans_insert ON atelier_bilans;
DROP POLICY IF EXISTS atelier_bilans_update ON atelier_bilans;
CREATE POLICY atelier_bilans_select ON atelier_bilans FOR SELECT USING (formateur_id = auth.uid());
CREATE POLICY atelier_bilans_insert ON atelier_bilans FOR INSERT WITH CHECK (formateur_id = auth.uid());
CREATE POLICY atelier_bilans_update ON atelier_bilans FOR UPDATE USING (formateur_id = auth.uid());

-- Storage bucket interventions-audio (public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('interventions-audio', 'interventions-audio', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "interventions_audio_public_read" ON storage.objects;
CREATE POLICY "interventions_audio_public_read" ON storage.objects FOR SELECT
  USING (bucket_id = 'interventions-audio');

DROP POLICY IF EXISTS "interventions_audio_formateur_write" ON storage.objects;
CREATE POLICY "interventions_audio_formateur_write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'interventions-audio' AND has_role(auth.uid(), 'formateur'::app_role));

DROP POLICY IF EXISTS "interventions_audio_formateur_update" ON storage.objects;
CREATE POLICY "interventions_audio_formateur_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'interventions-audio' AND has_role(auth.uid(), 'formateur'::app_role));

DROP POLICY IF EXISTS "interventions_audio_formateur_delete" ON storage.objects;
CREATE POLICY "interventions_audio_formateur_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'interventions-audio' AND has_role(auth.uid(), 'formateur'::app_role));