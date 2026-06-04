BEGIN;

ALTER TABLE public.profils_eleves
  ADD COLUMN IF NOT EXISTS fragilite_principale text,
  ADD COLUMN IF NOT EXISTS type_erreur_dominant text,
  ADD COLUMN IF NOT EXISTS seances_consecutives_sous_60 jsonb NOT NULL DEFAULT '{"CO":0,"CE":0,"EE":0,"EO":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS dernier_score_phase2_ce numeric,
  ADD COLUMN IF NOT EXISTS dernier_score_phase2_co numeric,
  ADD COLUMN IF NOT EXISTS montee_auto_phase2 boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profils_eleves_fragilite_principale_v4'
  ) THEN
    ALTER TABLE public.profils_eleves
      ADD CONSTRAINT chk_profils_eleves_fragilite_principale_v4
      CHECK (
        fragilite_principale IS NULL
        OR fragilite_principale IN ('CO','CE','EE','EO')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_profils_eleves_type_erreur_dominant_v4'
  ) THEN
    ALTER TABLE public.profils_eleves
      ADD CONSTRAINT chk_profils_eleves_type_erreur_dominant_v4
      CHECK (
        type_erreur_dominant IS NULL
        OR type_erreur_dominant IN (
          'linguistique',
          'phonetique',
          'socioculturel',
          'discursif',
          'strategique'
        )
      );
  END IF;
END $$;

UPDATE public.profils_eleves
SET seances_consecutives_sous_60 = '{"CO":0,"CE":0,"EE":0,"EO":0}'::jsonb
WHERE seances_consecutives_sous_60 IS NULL;

ALTER TABLE public.profils_eleves
  ALTER COLUMN seances_consecutives_sous_60 SET DEFAULT '{"CO":0,"CE":0,"EE":0,"EO":0}'::jsonb,
  ALTER COLUMN seances_consecutives_sous_60 SET NOT NULL,
  ALTER COLUMN montee_auto_phase2 SET DEFAULT false,
  ALTER COLUMN montee_auto_phase2 SET NOT NULL;

COMMIT;
