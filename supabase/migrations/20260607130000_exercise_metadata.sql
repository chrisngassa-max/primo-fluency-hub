-- LOT 6: structured exercise metadata, with backward-compatible JSON ingestion.

ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS metadata_code text,
  ADD COLUMN IF NOT EXISTS metadata_skill text,
  ADD COLUMN IF NOT EXISTS duree_limite_secondes integer,
  ADD COLUMN IF NOT EXISTS aides_disponibles text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS nombre_ecoutes_max integer,
  ADD COLUMN IF NOT EXISTS transcription_verrouillee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS objectif_tcf text,
  ADD COLUMN IF NOT EXISTS type_differenciation text;

ALTER TABLE public.exercices
  DROP CONSTRAINT IF EXISTS exercices_duree_limite_secondes_check,
  DROP CONSTRAINT IF EXISTS exercices_nombre_ecoutes_max_check,
  DROP CONSTRAINT IF EXISTS exercices_type_differenciation_check;

ALTER TABLE public.exercices
  ADD CONSTRAINT exercices_duree_limite_secondes_check
    CHECK (duree_limite_secondes IS NULL OR duree_limite_secondes BETWEEN 1 AND 7200),
  ADD CONSTRAINT exercices_nombre_ecoutes_max_check
    CHECK (nombre_ecoutes_max IS NULL OR nombre_ecoutes_max BETWEEN 1 AND 10),
  ADD CONSTRAINT exercices_type_differenciation_check
    CHECK (
      type_differenciation IS NULL
      OR type_differenciation IN ('demarrage', 'remediation', 'consolidation', 'approfondissement', 'bonus')
    );

CREATE OR REPLACE FUNCTION public.sync_exercise_structured_metadata()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  source_metadata jsonb := CASE
    WHEN jsonb_typeof(NEW.contenu -> 'metadata') = 'object' THEN NEW.contenu -> 'metadata'
    ELSE '{}'::jsonb
  END;
  raw_value text;
BEGIN
  NEW.metadata_code := COALESCE(NULLIF(NEW.metadata_code, ''), NULLIF(source_metadata ->> 'code', ''));
  NEW.metadata_skill := COALESCE(NULLIF(NEW.metadata_skill, ''), NULLIF(source_metadata ->> 'skill', ''));
  NEW.sous_competence := COALESCE(
    NULLIF(NEW.sous_competence, ''),
    NULLIF(source_metadata ->> 'sub_skill', ''),
    NULLIF(NEW.contenu ->> 'sous_competence', '')
  );

  raw_value := COALESCE(
    NULLIF(source_metadata ->> 'time_limit_seconds', ''),
    NULLIF(NEW.contenu ->> 'time_limit_seconds', ''),
    NULLIF(NEW.contenu ->> 'duree_estimee_secondes', '')
  );
  IF NEW.duree_limite_secondes IS NULL AND raw_value ~ '^[0-9]+$' THEN
    NEW.duree_limite_secondes := LEAST(7200, GREATEST(1, raw_value::integer));
  END IF;

  IF cardinality(NEW.aides_disponibles) = 0 THEN
    IF jsonb_typeof(NEW.contenu -> 'aides_disponibles') = 'array' THEN
      SELECT COALESCE(array_agg(value), '{}'::text[])
      INTO NEW.aides_disponibles
      FROM jsonb_array_elements_text(NEW.contenu -> 'aides_disponibles');
    ELSIF jsonb_typeof(source_metadata -> 'aides_disponibles') = 'array' THEN
      SELECT COALESCE(array_agg(value), '{}'::text[])
      INTO NEW.aides_disponibles
      FROM jsonb_array_elements_text(source_metadata -> 'aides_disponibles');
    END IF;
  END IF;

  raw_value := COALESCE(
    NULLIF(source_metadata ->> 'nombre_ecoutes_max', ''),
    NULLIF(NEW.contenu ->> 'nombre_ecoutes_max', '')
  );
  IF NEW.nombre_ecoutes_max IS NULL AND raw_value ~ '^[0-9]+$' THEN
    NEW.nombre_ecoutes_max := LEAST(10, GREATEST(1, raw_value::integer));
  END IF;

  raw_value := COALESCE(
    NULLIF(source_metadata ->> 'transcription_verrouillee', ''),
    NULLIF(NEW.contenu ->> 'transcription_verrouillee', '')
  );
  IF raw_value IS NOT NULL AND lower(raw_value) IN ('true', 'false') THEN
    NEW.transcription_verrouillee := raw_value::boolean;
  END IF;

  raw_value := lower(COALESCE(
    NULLIF(source_metadata ->> 'objectif_tcf', ''),
    NULLIF(NEW.contenu ->> 'objectif_tcf', '')
  ));
  IF NEW.objectif_tcf IS NULL AND raw_value IS NOT NULL THEN
    NEW.objectif_tcf := raw_value;
  END IF;

  raw_value := lower(COALESCE(
    NULLIF(source_metadata ->> 'type_differenciation', ''),
    NULLIF(NEW.contenu ->> 'type_differenciation', '')
  ));
  IF NEW.type_differenciation IS NULL
     AND raw_value IN ('demarrage', 'remediation', 'consolidation', 'approfondissement', 'bonus') THEN
    NEW.type_differenciation := raw_value;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_exercise_structured_metadata_trigger ON public.exercices;
CREATE TRIGGER sync_exercise_structured_metadata_trigger
BEFORE INSERT OR UPDATE OF contenu, metadata_code, metadata_skill, sous_competence,
  duree_limite_secondes, aides_disponibles, nombre_ecoutes_max,
  transcription_verrouillee, objectif_tcf, type_differenciation
ON public.exercices
FOR EACH ROW
EXECUTE FUNCTION public.sync_exercise_structured_metadata();

UPDATE public.exercices SET contenu = contenu;

CREATE INDEX IF NOT EXISTS idx_exercices_search_metadata
  ON public.exercices (competence, niveau_vise, difficulte);
CREATE INDEX IF NOT EXISTS idx_exercices_metadata_code
  ON public.exercices (metadata_code) WHERE metadata_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_exercices_objectif_differenciation
  ON public.exercices (objectif_tcf, type_differenciation);
CREATE INDEX IF NOT EXISTS idx_exercices_aides_disponibles
  ON public.exercices USING gin (aides_disponibles);

COMMENT ON COLUMN public.exercices.duree_limite_secondes IS
  'Maximum recommended duration for the learner; NULL means no enforced limit.';
COMMENT ON COLUMN public.exercices.nombre_ecoutes_max IS
  'Maximum audio plays; NULL means unlimited.';
COMMENT ON COLUMN public.exercices.transcription_verrouillee IS
  'When true, the learner cannot reveal the audio transcript.';
