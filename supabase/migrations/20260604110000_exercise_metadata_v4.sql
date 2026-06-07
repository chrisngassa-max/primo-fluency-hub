BEGIN;

ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS theme text,
  ADD COLUMN IF NOT EXISTS niveau_guidage text,
  ADD COLUMN IF NOT EXISTS outils_aide text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS duree_estimee_min integer,
  ADD COLUMN IF NOT EXISTS autonomie_requise text,
  ADD COLUMN IF NOT EXISTS objectif_tcf text,
  ADD COLUMN IF NOT EXISTS regle_montee_auto boolean NOT NULL DEFAULT false;

UPDATE public.exercices
SET outils_aide = '{}'::text[]
WHERE outils_aide IS NULL;

ALTER TABLE public.exercices
  ALTER COLUMN outils_aide SET DEFAULT '{}'::text[],
  ALTER COLUMN outils_aide SET NOT NULL,
  ALTER COLUMN regle_montee_auto SET DEFAULT false,
  ALTER COLUMN regle_montee_auto SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_exercices_theme_v4'
  ) THEN
    ALTER TABLE public.exercices
      ADD CONSTRAINT chk_exercices_theme_v4
      CHECK (
        theme IS NULL
        OR theme IN (
          'logement',
          'sante',
          'travail',
          'transport',
          'banque',
          'prefecture',
          'ecole',
          'vie_citoyenne'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_exercices_niveau_guidage_v4'
  ) THEN
    ALTER TABLE public.exercices
      ADD CONSTRAINT chk_exercices_niveau_guidage_v4
      CHECK (
        niveau_guidage IS NULL
        OR niveau_guidage IN ('guide','semi_guide','autonome')
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_exercices_outils_aide_v4'
  ) THEN
    ALTER TABLE public.exercices
      ADD CONSTRAINT chk_exercices_outils_aide_v4
      CHECK (
        outils_aide <@ ARRAY[
          'lexique',
          'modele_phrase',
          'audio_support',
          'photo',
          'criteres_reussite',
          'transcription'
        ]::text[]
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_exercices_duree_estimee_v4'
  ) THEN
    ALTER TABLE public.exercices
      ADD CONSTRAINT chk_exercices_duree_estimee_v4
      CHECK (
        duree_estimee_min IS NULL
        OR duree_estimee_min BETWEEN 1 AND 180
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_exercices_autonomie_requise_v4'
  ) THEN
    ALTER TABLE public.exercices
      ADD CONSTRAINT chk_exercices_autonomie_requise_v4
      CHECK (
        autonomie_requise IS NULL
        OR autonomie_requise IN ('faible','moyenne','forte')
      );
  END IF;
END $$;

COMMENT ON COLUMN public.exercices.theme IS 'Theme pedagogique V4: logement, sante, travail, transport, banque, prefecture, ecole, vie_citoyenne.';
COMMENT ON COLUMN public.exercices.niveau_guidage IS 'Niveau de guidage V4: guide, semi_guide, autonome.';
COMMENT ON COLUMN public.exercices.outils_aide IS 'Outils d aide disponibles: lexique, modele_phrase, audio_support, photo, criteres_reussite, transcription.';
COMMENT ON COLUMN public.exercices.duree_estimee_min IS 'Duree estimee en minutes, utilisee pour calibrer seances et devoirs.';
COMMENT ON COLUMN public.exercices.autonomie_requise IS 'Autonomie requise V4: faible, moyenne, forte.';
COMMENT ON COLUMN public.exercices.objectif_tcf IS 'Objectif TCF pedagogique, par exemple comprendre_info_explicite.';
COMMENT ON COLUMN public.exercices.regle_montee_auto IS 'Indique si cet exercice participe a la regle de montee automatique >=80 deux fois.';

COMMIT;
