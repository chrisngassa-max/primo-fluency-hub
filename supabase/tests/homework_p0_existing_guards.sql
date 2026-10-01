-- Exact public function/trigger definitions read on gudcenhmzlcvhgbgklzw, 2026-10-01.
-- Test fixture only. Never applied to remote; install after historical fixture rows.
CREATE OR REPLACE FUNCTION public.check_civic_publishable()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_missing text[];
  v_rank_old integer;
  v_rank_new integer;
  v_ranks jsonb := '{"draft":0,"technical_review":1,"pedagogical_review":2,"factual_review":3,"trainer_approved":4,"publishable":5,"published":6}'::jsonb;
BEGIN
  IF NOT NEW.civic_content THEN
    RETURN NEW;
  END IF;

  -- Contrôle de palier : s'applique à CHAQUE transition, indépendamment du
  -- statut cible (corrige le bug où draft->trainer_approved n'était jamais
  -- vérifié car hors du bloc publishable/published).
  IF TG_OP = 'UPDATE' THEN
    v_rank_old := COALESCE((v_ranks -> OLD.pedagogical_status)::text::integer, 0);
    v_rank_new := (v_ranks -> NEW.pedagogical_status)::text::integer;
    IF v_rank_new - v_rank_old > 1 THEN
      RAISE EXCEPTION 'DIFF_CIVIC_STAGE_SKIPPED: un exercice civique (%) ne peut pas sauter de % à % en une seule transition', NEW.id, OLD.pedagogical_status, NEW.pedagogical_status;
    END IF;
  ELSIF NEW.pedagogical_status <> 'draft' THEN
    RAISE EXCEPTION 'DIFF_CIVIC_STAGE_SKIPPED: un exercice civique (%) doit être créé en draft, jamais directement en %', NEW.id, NEW.pedagogical_status;
  END IF;

  -- Contrôle des faits sourcés : uniquement à l'atteinte de publishable/published.
  IF NEW.pedagogical_status IN ('publishable', 'published') THEN
    IF NEW.civic_fact_ids IS NULL OR array_length(NEW.civic_fact_ids, 1) IS NULL THEN
      RAISE EXCEPTION 'DIFF_FACT_SOURCE_UNVERIFIED: exercice civique % sans civic_fact_ids', NEW.id;
    END IF;

    SELECT array_agg(fid) INTO v_missing
    FROM unnest(NEW.civic_fact_ids) AS fid
    WHERE NOT EXISTS (
      SELECT 1 FROM public.civic_facts cf
      WHERE cf.fact_id = fid
        AND cf.status = 'active'
        AND cf.effective_from <= current_date
        AND (cf.effective_to IS NULL OR cf.effective_to > current_date)
        AND cf.source_url IS NOT NULL
        AND cf.content_hash IS NOT NULL
        AND cf.verified_at IS NOT NULL
        AND cf.validated_by IS NOT NULL
        AND cf.version >= 1
    );

    IF v_missing IS NOT NULL THEN
      RAISE EXCEPTION 'DIFF_FACT_SOURCE_EXPIRED: fait(s) civique(s) non actifs, non sourcés ou non validés humainement : %', v_missing;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.check_publishable_density()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.needs_content_review AND NEW.pedagogical_status IN ('publishable', 'published') THEN
    RAISE EXCEPTION 'DENSITY_BELOW_FLOOR: exercice % marqué needs_content_review=true, publication bloquée', NEW.id;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.enforce_exercise_modality()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare
  issues text[];
begin
  issues := public.exercise_modality_issues(
    new.titre,
    new.consigne,
    new.competence::text,
    new.format::text,
    new.contenu
  );
  if cardinality(issues) > 0 then
    raise exception using
      errcode = '23514',
      message = 'Exercice refusé : ' || array_to_string(issues, ' ');
  end if;
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.exercise_modality_issues(p_titre text, p_consigne text, p_competence text, p_format text, p_contenu jsonb)
 RETURNS text[]
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
declare
  issues text[] := array[]::text[];
  c jsonb := coalesce(p_contenu, '{}'::jsonb);
  items jsonb := coalesce(c->'items', '[]'::jsonb);
  audio_support text;
  reading_support text;
begin
  if nullif(btrim(coalesce(p_titre, '')), '') is null then
    issues := array_append(issues, 'Le titre est obligatoire.');
  end if;
  if nullif(btrim(coalesce(p_consigne, '')), '') is null then
    issues := array_append(issues, 'La consigne est obligatoire.');
  end if;

  audio_support := coalesce(
    nullif(btrim(c->>'script_audio'), ''),
    nullif(btrim(c->>'audio_script'), ''),
    nullif(btrim(c->>'support_audio'), ''),
    nullif(btrim(c->>'audio_url'), ''),
    nullif(btrim(c->>'url_audio'), ''),
    nullif(btrim(c->>'audio_src'), '')
  );

  reading_support := coalesce(
    nullif(btrim(c->>'texte'), ''),
    nullif(btrim(c->>'texte_support'), ''),
    nullif(btrim(c->>'support_texte'), ''),
    nullif(btrim(c->>'document'), ''),
    nullif(btrim(c->>'support'), ''),
    nullif(btrim(c->>'enonce'), ''),
    nullif(btrim(c->>'contexte'), '')
  );

  if upper(coalesce(p_competence, '')) = 'CO' then
    if audio_support is null then
      issues := array_append(issues, 'CO : ajoutez un script ou un fichier audio pour afficher le bouton d''écoute.');
    end if;
    if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
      issues := array_append(issues, 'CO : ajoutez au moins une question.');
    end if;
  elsif upper(coalesce(p_competence, '')) = 'CE' then
    if reading_support is null or length(reading_support) < 20 then
      issues := array_append(issues, 'CE : ajoutez le texte support visible par l''élève.');
    end if;
    if jsonb_typeof(items) <> 'array' or jsonb_array_length(items) = 0 then
      issues := array_append(issues, 'CE : ajoutez au moins une question.');
    end if;
  elsif upper(coalesce(p_competence, '')) = 'EE' then
    if lower(coalesce(p_format, '')) <> 'production_ecrite' then
      issues := array_append(issues, 'EE : le format production_ecrite est obligatoire pour afficher la zone de rédaction.');
    end if;
  elsif upper(coalesce(p_competence, '')) = 'EO' then
    if lower(coalesce(p_format, '')) <> 'production_orale' then
      issues := array_append(issues, 'EO : le format production_orale est obligatoire pour afficher l''enregistreur.');
    end if;
  end if;

  return issues;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.sync_exercise_structured_metadata()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
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
$function$
;
CREATE TRIGGER sync_exercise_structured_metadata_trigger BEFORE INSERT OR UPDATE OF contenu, metadata_code, metadata_skill, sous_competence, duree_limite_secondes, aides_disponibles, nombre_ecoutes_max, transcription_verrouillee, objectif_tcf, type_differenciation ON public.exercices FOR EACH ROW EXECUTE FUNCTION sync_exercise_structured_metadata();
CREATE TRIGGER trg_check_civic_publishable BEFORE INSERT OR UPDATE ON public.exercices FOR EACH ROW EXECUTE FUNCTION check_civic_publishable();
CREATE TRIGGER trg_check_publishable_density BEFORE INSERT OR UPDATE ON public.exercices FOR EACH ROW EXECUTE FUNCTION check_publishable_density();
CREATE TRIGGER trg_enforce_exercise_modality BEFORE INSERT OR UPDATE OF titre, consigne, competence, format, contenu, is_live_ready ON public.exercices FOR EACH ROW EXECUTE FUNCTION enforce_exercise_modality();

