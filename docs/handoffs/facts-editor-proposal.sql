-- PROPOSITION NON APPLIQUEE. Hors migrations. Revue et tests locaux requis.
-- ROLLBACK final volontaire : ce fichier n'est pas un script de livraison.
-- Le seul appelant futur est l'Edge authentifiee, jamais le navigateur.
-- p_server_hash vient de calculateFactsHash existant, jamais du body client.
BEGIN;

CREATE FUNCTION public.commit_studio_facts_revision(
  p_actor uuid, p_source uuid, p_family uuid,
  p_expected_source_updated_at timestamptz,
  p_expected_family_updated_at timestamptz,
  p_expected_hash text, p_expected_version integer,
  p_facts jsonb, p_server_hash text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog SET lock_timeout = '5s'
AS $$
DECLARE
  s public.pedagogical_sources%ROWTYPE;
  f public.differentiation_families%ROWTYPE;
  old_fact jsonb; new_fact jsonb; item jsonb; ref text; field text;
  ids text[] := ARRAY[]::text[];
  next_payload jsonb;
  report jsonb := '{"status":"not_run","blocking":[],"warnings":[],"requires_human_review":["facts_changed","answers_and_justifications"]}'::jsonb;
BEGIN
  IF current_user <> 'service_role' OR p_actor IS NULL
     OR NOT public.has_role(p_actor, 'formateur'::public.app_role) THEN
    RAISE EXCEPTION 'FACTS_REVISION_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  -- Ordre commun de verrouillage : source, puis familles de cette source.
  SELECT * INTO s FROM public.pedagogical_sources WHERE id=p_source FOR UPDATE;
  IF NOT FOUND OR s.created_by IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'SOURCE_FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  PERFORM id FROM public.differentiation_families
    WHERE source_id=p_source ORDER BY id FOR UPDATE;
  SELECT * INTO f FROM public.differentiation_families WHERE id=p_family;
  IF NOT FOUND OR f.source_id IS DISTINCT FROM p_source THEN
    RAISE EXCEPTION 'FAMILY_SOURCE_MISMATCH';
  END IF;
  IF f.target_level IS DISTINCT FROM 'A2' OR f.review_status IS DISTINCT FROM 'draft'
     OR f.generation_status IS DISTINCT FROM 'generated'
     OR f.published_exercise_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAMILY_NOT_EDITABLE';
  END IF;
  IF EXISTS (SELECT 1 FROM public.differentiation_families x
    WHERE x.source_id=p_source AND x.id<>p_family
      AND (x.review_status<>'archived' OR x.published_exercise_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'FACTS_ALREADY_REUSED';
  END IF;
  IF p_expected_hash IS NULL OR p_expected_version IS NULL
     OR s.updated_at IS DISTINCT FROM p_expected_source_updated_at
     OR f.updated_at IS DISTINCT FROM p_expected_family_updated_at
     OR f.payload #>> '{facts,facts_hash}' IS DISTINCT FROM p_expected_hash
     OR (f.payload->>'version')::integer IS DISTINCT FROM p_expected_version THEN
    RAISE EXCEPTION 'FACTS_REVISION_CONFLICT' USING ERRCODE='40001';
  END IF;
  IF s.metadata #>> '{studio_facts_confirmation,facts_hash}' = p_expected_hash THEN
    RAISE EXCEPTION 'FACTS_ALREADY_CONFIRMED';
  END IF;
  IF jsonb_typeof(p_facts) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'FACTS_INVALID'; END IF;
  IF jsonb_array_length(p_facts)=0 OR jsonb_array_length(p_facts)>100
     OR p_server_hash IS NULL OR p_server_hash !~ '^sha256:[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'FACTS_INVALID';
  END IF;
  FOR new_fact IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
    IF jsonb_typeof(new_fact) IS DISTINCT FROM 'object'
       OR nullif(btrim(new_fact->>'fact_id'),'') IS NULL
       OR (new_fact->>'fact_id')=ANY(ids) THEN RAISE EXCEPTION 'FACT_ID_INVALID'; END IF;
    ids := array_append(ids,new_fact->>'fact_id');
    SELECT value INTO old_fact FROM jsonb_array_elements(f.payload #> '{facts,required}')
      WHERE value->>'fact_id'=new_fact->>'fact_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'FACT_ID_UNKNOWN'; END IF;
    -- Seuls sujet/predicat/objet et speaker/viewpoint peuvent changer.
    -- La provenance, les preuves et tout autre attribut restent ceux du serveur.
    IF (new_fact - ARRAY['subject','predicate','object','semantic_qualifiers'])
       IS DISTINCT FROM (old_fact - ARRAY['subject','predicate','object','semantic_qualifiers'])
       OR (new_fact->'semantic_qualifiers' - ARRAY['speaker','viewpoint'])
       IS DISTINCT FROM (old_fact->'semantic_qualifiers' - ARRAY['speaker','viewpoint']) THEN
      RAISE EXCEPTION 'FACT_PROVENANCE_OR_ATTRIBUTES_CHANGED';
    END IF;
    FOREACH field IN ARRAY ARRAY['subject','predicate','object'] LOOP
      IF jsonb_typeof(new_fact->field) IS DISTINCT FROM 'string'
         OR nullif(btrim(new_fact->>field),'') IS NULL
         OR length(new_fact->>field)>4000 THEN RAISE EXCEPTION 'FACT_TEXT_INVALID'; END IF;
    END LOOP;
    FOREACH field IN ARRAY ARRAY['speaker','viewpoint'] LOOP
      IF new_fact->'semantic_qualifiers' ? field AND
         (jsonb_typeof(new_fact->'semantic_qualifiers'->field) IS DISTINCT FROM 'string'
          OR nullif(btrim(new_fact->'semantic_qualifiers'->>field),'') IS NULL
          OR length(new_fact->'semantic_qualifiers'->>field)>200) THEN
        RAISE EXCEPTION 'FACT_ATTRIBUTION_INVALID';
      END IF;
    END LOOP;
  END LOOP;
  FOR item IN SELECT value FROM jsonb_array_elements(f.payload #> '{variants,A2,exercise,items}') LOOP
    FOR ref IN SELECT jsonb_array_elements_text(item->'fact_refs') LOOP
      IF NOT ref=ANY(ids) THEN RAISE EXCEPTION 'FACT_REFERENCED_BY_ITEM:%',ref; END IF;
    END LOOP;
  END LOOP;
  -- Ne pas laisser de reference argumentative pendante apres un retrait.
  FOR new_fact IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
    FOREACH field IN ARRAY ARRAY['support_fact_ids','supporting_fact_refs'] LOOP
      FOR ref IN SELECT jsonb_array_elements_text(new_fact->'semantic_qualifiers'->field) LOOP
        IF NOT ref=ANY(ids) THEN RAISE EXCEPTION 'FACT_REFERENCED_BY_FACT:%',ref; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  next_payload := jsonb_set(f.payload,'{facts,required}',p_facts);
  next_payload := jsonb_set(next_payload,'{facts,facts_hash}',to_jsonb(p_server_hash));
  next_payload := jsonb_set(next_payload,'{version}',to_jsonb(p_expected_version+1));
  next_payload := jsonb_set(next_payload,'{status}','"draft"'::jsonb);
  next_payload := jsonb_set(next_payload,'{validation_report}',report);
  next_payload := jsonb_set(next_payload,'{facts_revision}',jsonb_build_object(
    'by',p_actor,'at',clock_timestamp(),'previous_hash',p_expected_hash,
    'previous_version',p_expected_version,'requires_review',true));
  UPDATE public.differentiation_families SET payload=next_payload,
    validation_status='pending',validation_report=report,review_status='draft' WHERE id=p_family;
  UPDATE public.pedagogical_sources
    SET metadata=coalesce(metadata,'{}'::jsonb)-'studio_facts_confirmation' WHERE id=p_source;
  RETURN jsonb_build_object('family_id',p_family,'facts_hash',p_server_hash,
    'version',p_expected_version+1,'review_status','draft','confirmation',NULL);
END;
$$;
REVOKE ALL ON FUNCTION public.commit_studio_facts_revision(uuid,uuid,uuid,timestamptz,timestamptz,text,integer,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_studio_facts_revision(uuid,uuid,uuid,timestamptz,timestamptz,text,integer,jsonb,text) TO service_role;

-- Fermer l'ecriture directe des faits par un client authentifie.
CREATE FUNCTION public.guard_studio_fact_payload() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN
    IF TG_OP='INSERT' THEN
      IF NEW.payload ? 'facts' THEN RAISE EXCEPTION 'FACTS_SERVER_WRITE_REQUIRED' USING ERRCODE='42501'; END IF;
    ELSIF NEW.payload->'facts' IS DISTINCT FROM OLD.payload->'facts'
       OR NEW.payload->'version' IS DISTINCT FROM OLD.payload->'version' THEN
      RAISE EXCEPTION 'FACTS_SERVER_WRITE_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_studio_fact_payload BEFORE INSERT OR UPDATE ON public.differentiation_families
  FOR EACH ROW EXECUTE FUNCTION public.guard_studio_fact_payload();

-- Refuser une confirmation devenue obsolete pendant la sauvegarde.
-- L'UPDATE de source detient deja son verrou ; meme ordre source -> famille.
CREATE FUNCTION public.guard_studio_facts_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c jsonb; h text; family_row record; matches integer:=0;
BEGIN
  c := NEW.metadata->'studio_facts_confirmation';
  IF c IS NOT DISTINCT FROM OLD.metadata->'studio_facts_confirmation' OR c IS NULL OR c='null'::jsonb THEN RETURN NEW; END IF;
  IF current_user NOT IN ('postgres','service_role') AND
     (auth.uid() IS DISTINCT FROM NEW.created_by OR
      NOT public.has_role(auth.uid(),'formateur'::public.app_role) OR
      c->>'confirmed_by' IS DISTINCT FROM auth.uid()::text) THEN
    RAISE EXCEPTION 'FACTS_CONFIRMATION_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  h := c->>'facts_hash';
  IF h IS NULL THEN RAISE EXCEPTION 'FACTS_CONFIRMATION_INVALID'; END IF;
  FOR family_row IN SELECT payload FROM public.differentiation_families
    WHERE source_id=NEW.id AND review_status<>'archived' ORDER BY id FOR SHARE LOOP
    IF family_row.payload #>> '{facts,facts_hash}' IS DISTINCT FROM h THEN
      RAISE EXCEPTION 'FACTS_CONFIRMATION_CONFLICT' USING ERRCODE='40001';
    END IF;
    matches:=matches+1;
  END LOOP;
  IF matches=0 THEN RAISE EXCEPTION 'FACTS_CONFIRMATION_INVALID'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_studio_facts_confirmation BEFORE UPDATE OF metadata ON public.pedagogical_sources
  FOR EACH ROW EXECUTE FUNCTION public.guard_studio_facts_confirmation();
REVOKE ALL ON FUNCTION public.guard_studio_fact_payload() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.guard_studio_facts_confirmation() FROM PUBLIC,anon,authenticated;

-- Pas de COMMIT : proposition seulement. Ne pas appliquer en production.
ROLLBACK;
