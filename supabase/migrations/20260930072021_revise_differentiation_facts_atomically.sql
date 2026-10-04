-- Local migration only. No data/backfill and no table grants.
BEGIN;

-- SQL implementation of canonical-json.ts on the supported facts domain.
-- Fail closed outside that domain, rather than silently producing a different hash.
-- Keys are lower-case ASCII snake_case; IDs fact_[0-9]+. Integer numbers only.
CREATE FUNCTION public.studio_facts_canonical_json(p_value jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE result text; k text;
BEGIN
  CASE jsonb_typeof(p_value)
    WHEN 'object' THEN
      FOR k IN SELECT jsonb_object_keys(p_value) LOOP
        IF k !~ '^[a-z_]+$' THEN RAISE EXCEPTION 'FACTS_CANONICAL_DOMAIN_UNSUPPORTED'; END IF;
      END LOOP;
      SELECT '{'||coalesce(string_agg(to_jsonb(key)::text||':'||public.studio_facts_canonical_json(value),',' ORDER BY key COLLATE "C"),'')||'}'
        INTO result FROM jsonb_each(p_value);
    WHEN 'array' THEN
      SELECT '['||coalesce(string_agg(public.studio_facts_canonical_json(value),',' ORDER BY ord),'')||']'
        INTO result FROM jsonb_array_elements(p_value) WITH ORDINALITY a(value,ord);
    WHEN 'number' THEN
      IF (p_value::text)::numeric<>trunc((p_value::text)::numeric)
         OR abs((p_value::text)::numeric)>9007199254740991 THEN
        RAISE EXCEPTION 'FACTS_CANONICAL_DOMAIN_UNSUPPORTED';
      END IF;
      result:=((p_value::text)::numeric::bigint)::text;
    ELSE result:=p_value::text;
  END CASE;
  RETURN result;
END;
$$;

CREATE FUNCTION public.studio_facts_hash(p_facts jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE projected jsonb; f jsonb;
BEGIN
  IF jsonb_typeof(p_facts) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'FACTS_INVALID'; END IF;
  FOR f IN SELECT value FROM jsonb_array_elements(p_facts) LOOP
    IF (f->>'fact_id') IS NULL OR f->>'fact_id' !~ '^fact_[0-9]+$' THEN
      RAISE EXCEPTION 'FACTS_CANONICAL_DOMAIN_UNSUPPORTED';
    END IF;
  END LOOP;
  -- Same semantic projection as fact-hashing.ts; absent fields remain absent.
  SELECT jsonb_agg((SELECT jsonb_object_agg(key,value) FROM jsonb_each(a.fact_value)
    WHERE key IN ('fact_id','subject','predicate','object','semantic_qualifiers','required_for_task'))
    ORDER BY a.fact_value->>'fact_id' COLLATE "C") INTO projected FROM jsonb_array_elements(p_facts) a(fact_value);
  RETURN 'sha256:'||encode(sha256(convert_to(public.studio_facts_canonical_json(coalesce(projected,'[]'::jsonb)),'UTF8')),'hex');
END;
$$;
REVOKE ALL ON FUNCTION public.studio_facts_canonical_json(jsonb),public.studio_facts_hash(jsonb) FROM PUBLIC,anon,authenticated,service_role;

-- Definer is needed to update guarded facts; callers must not gain direct writes.
-- Identity always comes from the verified caller JWT, never from an argument.
CREATE FUNCTION public.revise_differentiation_facts_atomically(
  p_source_id uuid, p_family_id uuid, p_expected_hash text,
  p_expected_version integer, p_expected_source_updated_at timestamptz, p_edits jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog SET lock_timeout='5s' AS $$
DECLARE
  actor uuid:=auth.uid(); s public.pedagogical_sources%ROWTYPE;
  f public.differentiation_families%ROWTYPE; edit jsonb; old_fact jsonb; revised jsonb;
  facts jsonb:='[]'; ids text[]:=ARRAY[]::text[]; field text; ref text; item jsonb;
  old_hash text; new_hash text; next_payload jsonb;
  report jsonb:='{"status":"not_run","blocking":[],"warnings":[],"requires_human_review":["facts_changed","answers_and_justifications"]}';
BEGIN
  IF actor IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED' USING ERRCODE='42501'; END IF;
  IF NOT public.has_role(actor,'formateur'::public.app_role) THEN
    RAISE EXCEPTION 'FACTS_REVISION_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  SELECT * INTO s FROM public.pedagogical_sources WHERE id=p_source_id FOR UPDATE;
  IF NOT FOUND OR s.created_by IS DISTINCT FROM actor THEN
    RAISE EXCEPTION 'SOURCE_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  PERFORM id FROM public.differentiation_families WHERE source_id=p_source_id ORDER BY id FOR UPDATE;
  SELECT * INTO f FROM public.differentiation_families WHERE id=p_family_id;
  IF NOT FOUND OR f.source_id IS DISTINCT FROM p_source_id THEN RAISE EXCEPTION 'FAMILY_SOURCE_MISMATCH'; END IF;
  IF f.target_level IS DISTINCT FROM 'A2' OR f.review_status IS DISTINCT FROM 'draft'
     OR f.generation_status IS DISTINCT FROM 'generated' OR f.published_exercise_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAMILY_NOT_EDITABLE';
  END IF;
  IF EXISTS(SELECT 1 FROM public.differentiation_families x WHERE x.source_id=p_source_id AND x.id<>p_family_id
    AND (x.review_status IS DISTINCT FROM 'archived' OR x.published_exercise_id IS NOT NULL)) THEN
    RAISE EXCEPTION 'FACTS_ALREADY_REUSED';
  END IF;
  old_hash:=f.payload #>> '{facts,facts_hash}';
  IF p_expected_hash IS NULL OR p_expected_version IS NULL
     OR old_hash IS DISTINCT FROM p_expected_hash
     OR (f.payload->>'version')::integer IS DISTINCT FROM p_expected_version
     OR s.updated_at IS DISTINCT FROM p_expected_source_updated_at THEN
    RAISE EXCEPTION 'FACTS_REVISION_CONFLICT' USING ERRCODE='40001';
  END IF;
  -- Existing hash must match the canonical module before accepting any edit.
  IF public.studio_facts_hash(f.payload #> '{facts,required}') IS DISTINCT FROM old_hash THEN
    RAISE EXCEPTION 'FACTS_CANONICAL_MISMATCH';
  END IF;
  IF jsonb_typeof(p_edits) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'FACTS_INVALID'; END IF;
  IF jsonb_array_length(p_edits) NOT BETWEEN 1 AND 100 OR octet_length(p_edits::text)>262144 THEN
    RAISE EXCEPTION 'FACTS_INVALID';
  END IF;
  FOR edit IN SELECT value FROM jsonb_array_elements(p_edits) LOOP
    IF jsonb_typeof(edit) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'FACTS_INVALID'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(edit) k WHERE k NOT IN ('fact_id','subject','predicate','object','speaker','viewpoint')) THEN
      RAISE EXCEPTION 'FACT_FIELDS_FORBIDDEN';
    END IF;
    IF nullif(edit->>'fact_id','') IS NULL OR edit->>'fact_id'=ANY(ids) THEN RAISE EXCEPTION 'FACT_ID_INVALID'; END IF;
    SELECT value INTO old_fact FROM jsonb_array_elements(f.payload #> '{facts,required}') WHERE value->>'fact_id'=edit->>'fact_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'FACT_ID_UNKNOWN'; END IF;
    ids:=array_append(ids,edit->>'fact_id'); revised:=old_fact;
    FOREACH field IN ARRAY ARRAY['subject','predicate','object'] LOOP
      IF jsonb_typeof(edit->field) IS DISTINCT FROM 'string' OR nullif(btrim(edit->>field),'') IS NULL
         OR length(edit->>field)>4000 THEN RAISE EXCEPTION 'FACT_TEXT_INVALID'; END IF;
      revised:=jsonb_set(revised,ARRAY[field],edit->field);
    END LOOP;
    IF jsonb_typeof(revised->'semantic_qualifiers') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'FACTS_INVALID'; END IF;
    FOREACH field IN ARRAY ARRAY['speaker','viewpoint'] LOOP
      IF edit ? field THEN
        IF jsonb_typeof(edit->field) IS DISTINCT FROM 'string' OR nullif(btrim(edit->>field),'') IS NULL
           OR length(edit->>field)>200 THEN RAISE EXCEPTION 'FACT_ATTRIBUTION_INVALID'; END IF;
        revised:=jsonb_set(revised,ARRAY['semantic_qualifiers',field],edit->field);
      END IF;
    END LOOP;
    facts:=facts||jsonb_build_array(revised);
  END LOOP;
  IF jsonb_typeof(f.payload #> '{variants,A2,exercise,items}') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'FACT_REFERENCES_INVALID'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(f.payload #> '{variants,A2,exercise,items}') LOOP
    IF jsonb_typeof(item->'fact_refs') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'FACT_REFERENCES_INVALID'; END IF;
    FOR ref IN SELECT jsonb_array_elements_text(item->'fact_refs') LOOP
      IF NOT ref=ANY(ids) THEN RAISE EXCEPTION 'FACT_REFERENCED_BY_ITEM'; END IF;
    END LOOP;
  END LOOP;
  FOR revised IN SELECT value FROM jsonb_array_elements(facts) LOOP
    FOREACH field IN ARRAY ARRAY['support_fact_ids','supporting_fact_refs'] LOOP
      FOR ref IN SELECT jsonb_array_elements_text(revised->'semantic_qualifiers'->field) LOOP
        IF NOT ref=ANY(ids) THEN RAISE EXCEPTION 'FACT_REFERENCED_BY_FACT'; END IF;
      END LOOP;
    END LOOP;
  END LOOP;
  new_hash:=public.studio_facts_hash(facts);
  next_payload:=jsonb_set(f.payload,'{facts,required}',facts);
  next_payload:=jsonb_set(next_payload,'{facts,facts_hash}',to_jsonb(new_hash));
  next_payload:=jsonb_set(next_payload,'{version}',to_jsonb(p_expected_version+1));
  next_payload:=jsonb_set(next_payload,'{status}','"draft"');
  next_payload:=jsonb_set(next_payload,'{validation_report}',report);
  next_payload:=jsonb_set(next_payload,'{facts_revision}',jsonb_build_object('by',actor,'at',clock_timestamp(),
    'previous_hash',old_hash,'previous_version',p_expected_version,'requires_review',true));
  UPDATE public.differentiation_families SET payload=next_payload,validation_status='pending',validation_report=report,review_status='draft' WHERE id=p_family_id;
  UPDATE public.pedagogical_sources SET metadata=coalesce(metadata,'{}')-'studio_facts_confirmation' WHERE id=p_source_id;
  RETURN jsonb_build_object('old_hash',old_hash,'new_hash',new_hash,'fact_count',jsonb_array_length(facts),'status','draft','version',p_expected_version+1);
END;
$$;
ALTER FUNCTION public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.revise_differentiation_facts_atomically(uuid,uuid,text,integer,timestamptz,jsonb) TO authenticated;

CREATE FUNCTION public.guard_studio_fact_payload() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
  IF current_user NOT IN ('postgres','service_role') THEN
    IF TG_OP='INSERT' THEN
      IF NEW.payload ? 'facts' THEN RAISE EXCEPTION 'FACTS_SERVER_WRITE_REQUIRED' USING ERRCODE='42501'; END IF;
    ELSIF NEW.payload->'facts' IS DISTINCT FROM OLD.payload->'facts'
      OR NEW.payload->'version' IS DISTINCT FROM OLD.payload->'version'
      OR NEW.payload->'facts_revision' IS DISTINCT FROM OLD.payload->'facts_revision'
      OR NEW.source_id IS DISTINCT FROM OLD.source_id THEN
      RAISE EXCEPTION 'FACTS_SERVER_WRITE_REQUIRED' USING ERRCODE='42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_studio_fact_payload BEFORE INSERT OR UPDATE ON public.differentiation_families
FOR EACH ROW EXECUTE FUNCTION public.guard_studio_fact_payload();

-- Serialize generation admission with revision/confirmation on the same source.
-- An Edge preflight alone is stale as soon as its SELECT completes.
CREATE FUNCTION public.guard_studio_facts_generation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog SET lock_timeout='5s' AS $$
DECLARE m jsonb; r record; h text;
BEGIN
  IF TG_OP='UPDATE' THEN
    -- A stale force-regenerate request must not hide the revision marker.
    IF OLD.payload ? 'facts_revision' AND (NEW.review_status IS DISTINCT FROM OLD.review_status
       AND NEW.review_status='archived') THEN
      RAISE EXCEPTION 'FACTS_REVISION_REGENERATION_FORBIDDEN';
    END IF;
    IF NEW.generation_status IS NOT DISTINCT FROM OLD.generation_status THEN RETURN NEW; END IF;
  END IF;
  IF NEW.generation_status IS DISTINCT FROM 'generating' THEN RETURN NEW; END IF;
  SELECT metadata INTO m FROM public.pedagogical_sources WHERE id=NEW.source_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'SOURCE_NOT_FOUND'; END IF;
  FOR r IN SELECT payload FROM public.differentiation_families
    WHERE source_id=NEW.source_id AND id<>NEW.id AND review_status<>'archived' AND payload ? 'facts_revision'
    ORDER BY id LOOP
    h:=r.payload #>> '{facts,facts_hash}';
    IF h IS NULL OR m #>> '{studio_facts_confirmation,facts_hash}' IS DISTINCT FROM h THEN
      RAISE EXCEPTION 'FACTS_CONFIRMATION_REQUIRED' USING ERRCODE='40001';
    END IF;
    IF NEW.payload #>> '{generation_facts_guard,facts_hash}' IS DISTINCT FROM h
       OR NEW.payload #> '{generation_facts_guard,correctif_05a_c}' IS DISTINCT FROM 'true'::jsonb THEN
      RAISE EXCEPTION 'FACTS_GENERATION_REVISION_CONFLICT' USING ERRCODE='40001';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_studio_facts_generation BEFORE INSERT OR UPDATE ON public.differentiation_families
FOR EACH ROW EXECUTE FUNCTION public.guard_studio_facts_generation();
REVOKE ALL ON FUNCTION public.guard_studio_facts_generation() FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.guard_studio_facts_confirmation() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c jsonb; h text; r record; n integer:=0;
BEGIN
  c:=NEW.metadata->'studio_facts_confirmation';
  IF c IS NOT DISTINCT FROM OLD.metadata->'studio_facts_confirmation' OR c IS NULL OR c='null'::jsonb THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.created_by
     OR NOT public.has_role(auth.uid(),'formateur'::public.app_role)
     OR c->>'confirmed_by' IS DISTINCT FROM auth.uid()::text THEN
    RAISE EXCEPTION 'FACTS_CONFIRMATION_FORBIDDEN' USING ERRCODE='42501';
  END IF;
  h:=c->>'facts_hash';
  IF h IS NULL THEN RAISE EXCEPTION 'FACTS_CONFIRMATION_INVALID'; END IF;
  FOR r IN SELECT payload FROM public.differentiation_families WHERE source_id=NEW.id AND review_status<>'archived' ORDER BY id FOR SHARE LOOP
    IF r.payload #>> '{facts,facts_hash}' IS DISTINCT FROM h THEN RAISE EXCEPTION 'FACTS_CONFIRMATION_CONFLICT' USING ERRCODE='40001'; END IF;
    n:=n+1;
  END LOOP;
  IF n=0 THEN RAISE EXCEPTION 'FACTS_CONFIRMATION_INVALID'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER guard_studio_facts_confirmation BEFORE UPDATE OF metadata ON public.pedagogical_sources
FOR EACH ROW EXECUTE FUNCTION public.guard_studio_facts_confirmation();
REVOKE ALL ON FUNCTION public.guard_studio_fact_payload(),public.guard_studio_facts_confirmation() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
