-- Local P0. No historical content update, no AI, no SECURITY DEFINER.
BEGIN;
CREATE SCHEMA homework_private;
REVOKE ALL ON SCHEMA homework_private FROM PUBLIC;
GRANT USAGE ON SCHEMA homework_private TO authenticated, service_role;

CREATE FUNCTION homework_private.has_text(v jsonb) RETURNS boolean
LANGUAGE sql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT coalesce(jsonb_typeof(v)='string' AND length(btrim(v #>> '{}'))>0,false)
$$;

CREATE FUNCTION homework_private.executable(e jsonb) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE c jsonb:=e->'contenu'; item jsonb; opt jsonb; raw_value text; f text:=e->>'format'; comp text:=e->>'competence';
BEGIN
 IF NOT homework_private.has_text(e->'titre') OR NOT homework_private.has_text(e->'consigne')
 OR comp IS NULL OR comp NOT IN ('CE','CO','EE','EO','Structures')
 OR f IS NULL OR f NOT IN ('qcm','vrai_faux','appariement','texte_lacunaire','transformation','production_ecrite','production_orale')
 OR jsonb_typeof(c) IS DISTINCT FROM 'object' OR c='{}'::jsonb THEN RETURN false; END IF;
 -- Mirror the existing metadata trigger's int4 cast BEFORE its LEAST/GREATEST clamp.
 FOREACH raw_value IN ARRAY ARRAY[
   coalesce(nullif(c#>>'{metadata,time_limit_seconds}',''),nullif(c->>'time_limit_seconds',''),nullif(c->>'duree_estimee_secondes','')),
   coalesce(nullif(c#>>'{metadata,nombre_ecoutes_max}',''),nullif(c->>'nombre_ecoutes_max',''))
 ] LOOP
   IF raw_value ~ '^[0-9]+$' AND NOT pg_input_is_valid(raw_value,'integer') THEN RETURN false; END IF;
 END LOOP;
 -- P0 renders texte; image-only and short supports fail the existing modality guard.
 IF comp='CE' AND (NOT homework_private.has_text(c->'texte') OR length(btrim(c->>'texte'))<20) THEN RETURN false; END IF;
 IF comp='CO' THEN
   IF c#>'{metadata,source_stale}'='true'::jsonb THEN RETURN false; END IF;
   IF NOT homework_private.has_text(c->'script_audio') THEN RETURN false; END IF;
   IF c->'audio' IS NOT NULL AND c->'audio'<>'null'::jsonb THEN
     IF jsonb_typeof(c->'audio') IS DISTINCT FROM 'object' OR NOT homework_private.has_text(c#>'{audio,source_id}') OR NOT homework_private.has_text(c#>'{audio,source_content_hash}') THEN RETURN false; END IF;
   ELSIF NOT homework_private.has_text(c->'script_audio') THEN RETURN false;
   END IF;
 END IF;
 IF (comp='EE')<>(f='production_ecrite') OR (comp='EO')<>(f='production_orale') THEN RETURN false; END IF;
 IF jsonb_typeof(c->'items') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
 IF jsonb_array_length(c->'items')=0 OR (f='production_orale' AND jsonb_array_length(c->'items')<>1) THEN RETURN false; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(c->'items') LOOP
   IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR NOT homework_private.has_text(item->'question') THEN RETURN false; END IF;
   IF item ? 'options' THEN
     IF jsonb_typeof(item->'options') IS DISTINCT FROM 'array' THEN RETURN false; END IF;
     FOR opt IN SELECT value FROM jsonb_array_elements(item->'options') LOOP
       IF NOT homework_private.has_text(opt) THEN RETURN false; END IF;
     END LOOP;
   END IF;
   IF f IN ('production_ecrite','production_orale') THEN
     IF coalesce(jsonb_array_length(item->'options'),0)>0 THEN RETURN false; END IF;
   ELSE
     IF NOT homework_private.has_text(item->'bonne_reponse') THEN RETURN false; END IF;
     IF f='qcm' AND (coalesce(jsonb_array_length(item->'options'),0)<2 OR
        (SELECT count(DISTINCT value) FROM jsonb_array_elements(item->'options'))<>jsonb_array_length(item->'options')) THEN RETURN false; END IF;
     IF coalesce(jsonb_array_length(item->'options'),0)>0 AND NOT (item->'options' @> jsonb_build_array(item->'bonne_reponse')) THEN RETURN false; END IF;
     IF f='vrai_faux' AND lower(btrim(item->>'bonne_reponse')) NOT IN ('vrai','faux','true','false') THEN RETURN false; END IF;
   END IF;
 END LOOP;
 RETURN true;
END $$;

CREATE FUNCTION homework_private.audio_available(e jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog AS $$
 SELECT CASE WHEN e->>'competence'<>'CO' OR e#>'{contenu,audio}' IS NULL OR e#>'{contenu,audio}'='null'::jsonb THEN true ELSE
 (SELECT count(*)=1 FROM public.differentiation_families f JOIN public.pedagogical_sources s ON s.id=f.source_id
 WHERE f.published_exercise_id::text=e->>'id' AND f.review_status='published'
 AND f.source_id::text=e#>>'{contenu,audio,source_id}'
 AND f.source_content_hash=e#>>'{contenu,audio,source_content_hash}'
 AND s.content_hash=f.source_content_hash AND s.content_hash LIKE 'sha256:%'
 AND s.source_kind='audio' AND s.status='analyzed' AND s.review_status IN ('utilisable','valide')
 AND length(s.storage_bucket)>0 AND length(s.storage_path)>0) END
$$;

-- Fast defaults: no UPDATE/backfill of exercises or historical homework.
-- Existing rows keep a legacy true marker, but every NEW assignment is validated.
-- FK enforcement sees referencing rows irrespective of caller RLS, unlike a trigger SELECT.
ALTER TABLE public.exercices ADD COLUMN p0_homework_executable boolean NOT NULL DEFAULT true;
ALTER TABLE public.exercices ADD CONSTRAINT p0_homework_exercise_key UNIQUE(id,p0_homework_executable);
ALTER TABLE public.devoirs ADD COLUMN p0_requires_executable boolean NOT NULL DEFAULT true;
ALTER TABLE public.devoirs ADD CONSTRAINT p0_homework_requires_true CHECK(p0_requires_executable);
ALTER TABLE public.devoirs ADD CONSTRAINT p0_homework_executable_fk
 FOREIGN KEY(exercice_id,p0_requires_executable) REFERENCES public.exercices(id,p0_homework_executable)
 ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;
ALTER TABLE public.exercise_assignments ADD COLUMN p0_requires_executable boolean NOT NULL DEFAULT true;
ALTER TABLE public.exercise_assignments ADD CONSTRAINT p0_assignment_requires_true CHECK(p0_requires_executable);
ALTER TABLE public.exercise_assignments ADD CONSTRAINT p0_assignment_executable_fk
 FOREIGN KEY(exercise_id,p0_requires_executable) REFERENCES public.exercices(id,p0_homework_executable)
 ON UPDATE RESTRICT ON DELETE CASCADE NOT VALID;

CREATE FUNCTION homework_private.guard_exercise() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
BEGIN
 IF TG_OP='INSERT' THEN
   -- An original audio exercise is inserted before its publication-family link.
   -- New assignments still check that link; incomplete JSON always gets false.
   NEW.p0_homework_executable:=homework_private.executable(to_jsonb(NEW));
 ELSIF (to_jsonb(NEW)-ARRAY['updated_at','statut','p0_homework_executable']) IS DISTINCT FROM
       (to_jsonb(OLD)-ARRAY['updated_at','statut','p0_homework_executable'])
       OR NEW.p0_homework_executable IS DISTINCT FROM OLD.p0_homework_executable THEN
   NEW.p0_homework_executable:=homework_private.executable(to_jsonb(NEW)) AND homework_private.audio_available(to_jsonb(NEW));
 ELSE RETURN NEW;
 END IF;
 IF NEW.is_devoir AND (NOT NEW.p0_homework_executable OR NOT homework_private.audio_available(to_jsonb(NEW))) THEN
   RAISE EXCEPTION 'homework_inexecutable' USING ERRCODE='23514';
 END IF;
 -- Turning true to false on an assigned exercise is prevented by the composite FK.
 RETURN NEW;
END $$;
CREATE TRIGGER p0_guard_exercise BEFORE INSERT OR UPDATE ON public.exercices
 FOR EACH ROW EXECUTE FUNCTION homework_private.guard_exercise();

CREATE FUNCTION homework_private.guard_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE e public.exercices;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.exercice_id=OLD.exercice_id AND NEW.eleve_id=OLD.eleve_id
     AND NEW.formateur_id=OLD.formateur_id AND NEW.session_id IS NOT DISTINCT FROM OLD.session_id
     AND NEW.p0_requires_executable=OLD.p0_requires_executable THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO e FROM public.exercices WHERE id=NEW.exercice_id FOR KEY SHARE;
 IF NOT FOUND OR NOT homework_private.executable(to_jsonb(e)) OR NOT homework_private.audio_available(to_jsonb(e)) THEN
   RAISE EXCEPTION 'homework_inexecutable' USING ERRCODE='23514';
 END IF;
 -- A draft audio link may have become published since its last content edit.
 -- Only an owner allowed by existing UPDATE RLS can refresh its technical marker.
 IF NOT e.p0_homework_executable THEN
   UPDATE public.exercices SET p0_homework_executable=true WHERE id=e.id;
 END IF;
 NEW.p0_requires_executable:=true;
 RETURN NEW;
END $$;
CREATE TRIGGER p0_guard_assignment BEFORE INSERT OR UPDATE ON public.devoirs
 FOR EACH ROW EXECUTE FUNCTION homework_private.guard_assignment();

-- Independent PlayExercise assignments; devoirs are not mirrored into this table.
CREATE FUNCTION homework_private.guard_independent_assignment() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE e public.exercices;
BEGIN
 IF TG_OP='UPDATE' THEN
   IF NEW.exercise_id IS NOT DISTINCT FROM OLD.exercise_id
     AND NEW.learner_id IS NOT DISTINCT FROM OLD.learner_id
     AND NEW.group_id IS NOT DISTINCT FROM OLD.group_id
     AND NEW.assigned_by IS NOT DISTINCT FROM OLD.assigned_by
     AND NEW.p0_requires_executable=OLD.p0_requires_executable THEN RETURN NEW; END IF;
 END IF;
 SELECT * INTO e FROM public.exercices WHERE id=NEW.exercise_id FOR KEY SHARE;
 IF NOT FOUND OR NOT homework_private.executable(to_jsonb(e)) OR NOT homework_private.audio_available(to_jsonb(e)) THEN
   RAISE EXCEPTION 'homework_inexecutable' USING ERRCODE='23514'; END IF;
 IF NOT e.p0_homework_executable THEN
   UPDATE public.exercices SET p0_homework_executable=true WHERE id=e.id;
 END IF;
 NEW.p0_requires_executable:=true;
 RETURN NEW;
END $$;
CREATE TRIGGER p0_guard_independent_assignment BEFORE INSERT OR UPDATE ON public.exercise_assignments
 FOR EACH ROW EXECUTE FUNCTION homework_private.guard_independent_assignment();

-- Not exposed via PostgREST. No educational content, answers or student identifiers.
-- Retain receipts indefinitely for permanent request-id deduplication; no automatic purge.
CREATE TABLE homework_private.receipts (
 owner_id uuid NOT NULL, request_id uuid NOT NULL, payload_hash text NOT NULL,
 exercise_count integer NOT NULL CHECK(exercise_count>0), homework_count integer NOT NULL CHECK(homework_count>0),
 created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(owner_id,request_id)
);
ALTER TABLE homework_private.receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE homework_private.receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY p0_receipt_owner ON homework_private.receipts TO authenticated
 USING(owner_id=auth.uid() AND public.has_role(auth.uid(),'formateur'))
 WITH CHECK(owner_id=auth.uid() AND public.has_role(auth.uid(),'formateur'));
REVOKE ALL ON homework_private.receipts FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT,INSERT ON homework_private.receipts TO authenticated;

CREATE FUNCTION public.send_automatic_homework(p_request_id uuid,p_session_id uuid,p_group_id uuid,p_deadline timestamptz,p_entries jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog AS $$
DECLARE uid uuid:=auth.uid(); h text; receipt homework_private.receipts; entry jsonb; ex jsonb; row_ex public.exercices;
 n integer; student uuid; series integer; new_id uuid;
BEGIN
 IF uid IS NULL OR NOT public.has_role(uid,'formateur') THEN RAISE EXCEPTION 'homework_forbidden' USING ERRCODE='42501'; END IF;
 IF p_request_id IS NULL THEN RAISE EXCEPTION 'homework_request_required' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM public.groups WHERE id=p_group_id AND formateur_id=uid FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'homework_group_forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM public.sessions WHERE id=p_session_id AND group_id=p_group_id FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'homework_session_forbidden' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_entries) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'homework_invalid_entries' USING ERRCODE='22023'; END IF;
 n:=jsonb_array_length(p_entries);
 IF n=0 THEN RAISE EXCEPTION 'homework_empty_batch' USING ERRCODE='22023'; END IF;
 h:=encode(sha256(convert_to(jsonb_build_object('session',p_session_id,'group',p_group_id,'deadline',extract(epoch FROM p_deadline),'entries',p_entries)::text,'UTF8')),'hex');
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||':'||p_request_id::text,0));
 SELECT * INTO receipt FROM homework_private.receipts WHERE owner_id=uid AND request_id=p_request_id;
 IF FOUND THEN
   IF receipt.payload_hash<>h THEN RAISE EXCEPTION 'homework_request_conflict' USING ERRCODE='22023'; END IF;
   RETURN jsonb_build_object('request_id',p_request_id,'exercise_count',receipt.exercise_count,'homework_count',receipt.homework_count);
 END IF;
 IF p_deadline IS NULL OR NOT isfinite(p_deadline) OR p_deadline<=now() THEN RAISE EXCEPTION 'homework_invalid_deadline' USING ERRCODE='22023'; END IF;
 FOR entry IN SELECT value FROM jsonb_array_elements(p_entries) LOOP
   IF jsonb_typeof(entry) IS DISTINCT FROM 'object' OR entry - ARRAY['student_id','serie','exercise'] <> '{}'::jsonb THEN RAISE EXCEPTION 'homework_invalid_entry' USING ERRCODE='22023'; END IF;
   student:=(entry->>'student_id')::uuid; series:=(entry->>'serie')::integer; ex:=entry->'exercise';
   PERFORM 1 FROM public.group_members WHERE group_id=p_group_id AND eleve_id=student FOR SHARE;
   IF NOT FOUND THEN RAISE EXCEPTION 'homework_student_forbidden' USING ERRCODE='42501'; END IF;
   IF series IS NULL OR series NOT IN (1,2) OR jsonb_typeof(ex) IS DISTINCT FROM 'object'
     OR ex-ARRAY['titre','consigne','competence','format','niveau_vise','difficulte','contenu','point_a_maitriser_id']<>'{}'::jsonb
     OR NOT homework_private.executable(ex) THEN RAISE EXCEPTION 'homework_inexecutable' USING ERRCODE='23514'; END IF;
   -- Published original audio is bound to the original exercise/family: cloning it breaks resolution.
   IF ex->>'competence'='CO' AND ex#>'{contenu,audio}' IS NOT NULL AND ex#>'{contenu,audio}'<>'null'::jsonb THEN
     RAISE EXCEPTION 'homework_original_audio_use_manual' USING ERRCODE='23514'; END IF;
   row_ex:=jsonb_populate_record(NULL::public.exercices,ex);
   INSERT INTO public.exercices(formateur_id,eleve_id,titre,consigne,competence,format,niveau_vise,difficulte,contenu,point_a_maitriser_id,is_devoir,is_ai_generated)
   VALUES(uid,student,row_ex.titre,row_ex.consigne,row_ex.competence,row_ex.format,row_ex.niveau_vise,row_ex.difficulte,row_ex.contenu,row_ex.point_a_maitriser_id,true,false)
   RETURNING id INTO new_id;
   INSERT INTO public.devoirs(formateur_id,eleve_id,exercice_id,session_id,contexte,serie,raison,date_echeance,source_label)
   VALUES(uid,student,new_id,p_session_id,'devoir',series,
     (CASE WHEN series=1 THEN 'remediation' ELSE 'consolidation' END)::public.devoir_raison,p_deadline,'session_personalized_validated');
 END LOOP;
 INSERT INTO homework_private.receipts(owner_id,request_id,payload_hash,exercise_count,homework_count) VALUES(uid,p_request_id,h,n,n);
 RETURN jsonb_build_object('request_id',p_request_id,'exercise_count',n,'homework_count',n);
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA homework_private FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION homework_private.has_text(jsonb),homework_private.executable(jsonb),homework_private.audio_available(jsonb) TO authenticated,service_role;
REVOKE ALL ON FUNCTION public.send_automatic_homework(uuid,uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon,service_role;
GRANT EXECUTE ON FUNCTION public.send_automatic_homework(uuid,uuid,uuid,timestamptz,jsonb) TO authenticated;
COMMIT;
